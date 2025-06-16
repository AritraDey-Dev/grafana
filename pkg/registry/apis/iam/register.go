package iam

import (
	"context"
	"strings"

	"github.com/prometheus/client_golang/prometheus"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/apiserver/pkg/registry/rest"
	genericapiserver "k8s.io/apiserver/pkg/server"
	common "k8s.io/kube-openapi/pkg/common"
	"k8s.io/kube-openapi/pkg/spec3"
	"k8s.io/kube-openapi/pkg/validation/spec"

	"github.com/grafana/authlib/types"
	iamv0b "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	iamv0 "github.com/grafana/grafana/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/registry/apis/iam/corerole"
	"github.com/grafana/grafana/pkg/registry/apis/iam/legacy"
	"github.com/grafana/grafana/pkg/registry/apis/iam/serviceaccount"
	"github.com/grafana/grafana/pkg/registry/apis/iam/sso"
	"github.com/grafana/grafana/pkg/registry/apis/iam/team"
	"github.com/grafana/grafana/pkg/registry/apis/iam/user"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/ssosettings"
	"github.com/grafana/grafana/pkg/storage/legacysql"
)

var _ builder.APIGroupBuilder = (*IdentityAccessManagementAPIBuilder)(nil)
var _ builder.APIGroupRouteProvider = (*IdentityAccessManagementAPIBuilder)(nil)

// This is used just so wire has something unique to return
type IdentityAccessManagementAPIBuilder struct {
	store      legacy.LegacyIdentityStore
	authorizer authorizer.Authorizer
	// legacyAccessClient is used for the identity apis, we need to migrate to the access client
	legacyAccessClient types.AccessClient
	// accessClient is used for the core role apis
	accessClient types.AccessClient

	dbProvider legacysql.LegacyDatabaseProvider

	reg prometheus.Registerer

	// non-k8s api route
	display *user.LegacyDisplayREST

	// Not set for multi-tenant deployment for now
	sso ssosettings.Service

	enableAuthZResources bool
}

func RegisterAPIService(
	features featuremgmt.FeatureToggles,
	apiregistration builder.APIRegistrar,
	ssoService ssosettings.Service,
	sql db.DB,
	ac accesscontrol.AccessControl,
	accessClient types.AccessClient,
) (*IdentityAccessManagementAPIBuilder, error) {
	dbProvider := legacysql.NewDatabaseProvider(sql)
	store := legacy.NewLegacySQLStores(dbProvider)
	authorizer, client := newLegacyAuthorizer(ac, store)

	builder := &IdentityAccessManagementAPIBuilder{
		store:                store,
		dbProvider:           dbProvider,
		sso:                  ssoService,
		authorizer:           authorizer,
		legacyAccessClient:   client,
		accessClient:         accessClient,
		display:              user.NewLegacyDisplayREST(store),
		enableAuthZResources: features.IsEnabledGlobally(featuremgmt.FlagKubernetesAuthzApis),
	}
	apiregistration.RegisterAPI(builder)

	return builder, nil
}

func NewAPIService(store legacy.LegacyIdentityStore) *IdentityAccessManagementAPIBuilder {
	return &IdentityAccessManagementAPIBuilder{
		store:   store,
		display: user.NewLegacyDisplayREST(store),
		authorizer: authorizer.AuthorizerFunc(
			func(ctx context.Context, a authorizer.Attributes) (authorizer.Decision, string, error) {
				user, err := identity.GetRequester(ctx)
				if err != nil {
					return authorizer.DecisionDeny, "no identity found", err
				}
				if user.GetIsGrafanaAdmin() {
					return authorizer.DecisionAllow, "", nil
				}
				return authorizer.DecisionDeny, "only grafana admins have access for now", nil
			}),
	}
}

func (b *IdentityAccessManagementAPIBuilder) GetGroupVersion() schema.GroupVersion {
	return iamv0.SchemeGroupVersion
}

func (b *IdentityAccessManagementAPIBuilder) InstallSchema(scheme *runtime.Scheme) error {
	if b.enableAuthZResources {
		iamv0b.AddToScheme(scheme)
	}

	iamv0.AddKnownTypes(scheme, iamv0.VERSION)

	// Link this version to the internal representation.
	// This is used for server-side-apply (PATCH), and avoids the error:
	// "no kind is registered for the type"
	iamv0.AddKnownTypes(scheme, runtime.APIVersionInternal)

	metav1.AddToGroupVersion(scheme, iamv0.SchemeGroupVersion)
	return scheme.SetVersionPriority(iamv0.SchemeGroupVersion)
}

func (b *IdentityAccessManagementAPIBuilder) UpdateAPIGroupInfo(apiGroupInfo *genericapiserver.APIGroupInfo, opts builder.APIGroupOptions) error {
	storage := map[string]rest.Storage{}

	teamResource := iamv0.TeamResourceInfo
	storage[teamResource.StoragePath()] = team.NewLegacyStore(b.store, b.legacyAccessClient)
	storage[teamResource.StoragePath("members")] = team.NewLegacyTeamMemberREST(b.store)

	teamBindingResource := iamv0.TeamBindingResourceInfo
	storage[teamBindingResource.StoragePath()] = team.NewLegacyBindingStore(b.store)

	userResource := iamv0.UserResourceInfo
	storage[userResource.StoragePath()] = user.NewLegacyStore(b.store, b.legacyAccessClient)
	storage[userResource.StoragePath("teams")] = user.NewLegacyTeamMemberREST(b.store)

	serviceAccountResource := iamv0.ServiceAccountResourceInfo
	storage[serviceAccountResource.StoragePath()] = serviceaccount.NewLegacyStore(b.store, b.legacyAccessClient)
	storage[serviceAccountResource.StoragePath("tokens")] = serviceaccount.NewLegacyTokenREST(b.store)

	if b.sso != nil {
		ssoResource := iamv0.SSOSettingResourceInfo
		storage[ssoResource.StoragePath()] = sso.NewLegacyStore(b.sso)
	}

	if b.enableAuthZResources {
		// v0alpha1
		coreRoleResource := iamv0b.CoreRoleInfo
		// TODO
		// TODO wrong accessClient
		store, err := corerole.NewStore(
			coreRoleResource,
			apiGroupInfo.Scheme,
			opts.OptsGetter,
			b.reg, b.accessClient,
			b.dbProvider,
		)
		if err != nil {
			return err
		}
		storage[coreRoleResource.StoragePath()] = store
	}

	apiGroupInfo.VersionedResourcesStorageMap[iamv0.VERSION] = storage
	return nil
}

func (b *IdentityAccessManagementAPIBuilder) GetOpenAPIDefinitions() common.GetOpenAPIDefinitions {
	defs := iamv0.GetOpenAPIDefinitions
	if b.enableAuthZResources {
		defs = func(ref common.ReferenceCallback) map[string]common.OpenAPIDefinition {
			def1 := iamv0.GetOpenAPIDefinitions(ref)
			def2 := iamv0b.GetOpenAPIDefinitions(ref)
			for k, v := range def2 {
				def1[k] = v
			}
			return def1
		}
	}
	return defs
}

func (b *IdentityAccessManagementAPIBuilder) PostProcessOpenAPI(oas *spec3.OpenAPI) (*spec3.OpenAPI, error) {
	oas.Info.Description = "Identity and Access Management"

	defs := b.GetOpenAPIDefinitions()(func(path string) spec.Ref { return spec.Ref{} })
	defsBase := "github.com/grafana/grafana/pkg/apis/iam/v0alpha1."

	// Add missing schemas
	for k, v := range defs {
		clean := strings.Replace(k, defsBase, "com.github.grafana.grafana.pkg.apis.iam.v0alpha1.", 1)
		if oas.Components.Schemas[clean] == nil {
			oas.Components.Schemas[clean] = &v.Schema
		}
	}
	compBase := "com.github.grafana.grafana.pkg.apis.iam.v0alpha1."
	schema := oas.Components.Schemas[compBase+"DisplayList"].Properties["display"]
	schema.Items = &spec.SchemaOrArray{
		Schema: &spec.Schema{
			SchemaProps: spec.SchemaProps{
				AllOf: []spec.Schema{
					{
						SchemaProps: spec.SchemaProps{
							Ref: spec.MustCreateRef("#/components/schemas/" + compBase + "Display"),
						},
					},
				},
			},
		},
	}
	oas.Components.Schemas[compBase+"DisplayList"].Properties["display"] = schema
	oas.Components.Schemas[compBase+"DisplayList"].Properties["metadata"] = spec.Schema{
		SchemaProps: spec.SchemaProps{
			AllOf: []spec.Schema{
				{
					SchemaProps: spec.SchemaProps{
						Ref: spec.MustCreateRef("#/components/schemas/io.k8s.apimachinery.pkg.apis.meta.v1.ListMeta"),
					},
				},
			}},
	}
	oas.Components.Schemas[compBase+"Display"].Properties["identity"] = spec.Schema{
		SchemaProps: spec.SchemaProps{
			AllOf: []spec.Schema{
				{
					SchemaProps: spec.SchemaProps{
						Ref: spec.MustCreateRef("#/components/schemas/" + compBase + "IdentityRef"),
					},
				},
			}},
	}
	return oas, nil
}

func (b *IdentityAccessManagementAPIBuilder) GetAPIRoutes(gv schema.GroupVersion) *builder.APIRoutes {
	defs := b.GetOpenAPIDefinitions()(func(path string) spec.Ref { return spec.Ref{} })
	return b.display.GetAPIRoutes(defs)
}

func (b *IdentityAccessManagementAPIBuilder) GetAuthorizer() authorizer.Authorizer {
	return b.authorizer
}
