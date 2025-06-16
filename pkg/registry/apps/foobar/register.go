package foobar

import (
	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/simple"

	"github.com/grafana/grafana/apps/foobar/pkg/apis"
	foobarv1 "github.com/grafana/grafana/apps/foobar/pkg/apis/foobar/v1"
	foobarapp "github.com/grafana/grafana/apps/foobar/pkg/app"
	"github.com/grafana/grafana/pkg/services/apiserver/builder/runner"
	"github.com/grafana/grafana/pkg/setting"
)

type AppProvider struct {
	app.Provider
	cfg *setting.Cfg
}

func RegisterApp(
	cfg *setting.Cfg,
) *AppProvider {
	provider := &AppProvider{
		cfg: cfg,
	}
	appCfg := &runner.AppBuilderConfig{
		OpenAPIDefGetter: foobarv1.GetOpenAPIDefinitions,
		ManagedKinds:     foobarapp.GetKinds(),
		Authorizer:       foobarapp.GetAuthorizer(),
	}
	provider.Provider = simple.NewAppProvider(apis.LocalManifest(), appCfg, foobarapp.New)
	return provider
}
