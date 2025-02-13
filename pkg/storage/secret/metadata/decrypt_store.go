package metadata

import (
	"context"
	"fmt"

	claims "github.com/grafana/authlib/types"
	secretv0alpha1 "github.com/grafana/grafana/pkg/apis/secret/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/registry/apis/secret/secretkeeper"
	keepertypes "github.com/grafana/grafana/pkg/registry/apis/secret/secretkeeper/types"
	"github.com/grafana/grafana/pkg/registry/apis/secret/xkube"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
)

func ProvideDecryptStorage(db db.DB, cfg *setting.Cfg, features featuremgmt.FeatureToggles, keeperService secretkeeper.Service) (contracts.DecryptStorage, error) {
	if !features.IsEnabledGlobally(featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs) ||
		!features.IsEnabledGlobally(featuremgmt.FlagSecretsManagementAppPlatform) {
		return &decryptStorage{}, nil
	}

	keepers, err := keeperService.GetKeepers()
	if err != nil {
		return nil, fmt.Errorf("failed to get keepers: %w", err)
	}

	return &decryptStorage{db: db, keepers: keepers}, nil
}

// decryptStorage is the actual implementation of the decrypt storage.
type decryptStorage struct {
	db      db.DB
	keepers map[keepertypes.KeeperType]keepertypes.Keeper
}

func (s *decryptStorage) Decrypt(ctx context.Context, namespace xkube.Namespace, name string) (secretv0alpha1.ExposedSecureValue, error) {
	// TODO: do proper checks here.
	_, ok := claims.AuthInfoFrom(ctx)
	if !ok {
		return "", fmt.Errorf("missing auth info in context")
	}

	exposedValue, err := s.decryptFromKeeper(ctx, namespace, name)
	if err != nil {
		return "", fmt.Errorf("decrypt from keeper: %w", err)
	}

	return exposedValue, nil
}

func (s *decryptStorage) decryptFromKeeper(ctx context.Context, namespace xkube.Namespace, name string) (secretv0alpha1.ExposedSecureValue, error) {
	sv := &secureValueDB{Namespace: namespace.String(), Name: name}
	err := s.db.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		found, err := sess.Get(sv)
		if err != nil {
			return fmt.Errorf("could not get row: %w", err)
		}
		if !found {
			return contracts.ErrSecureValueNotFound
		}

		return nil
	})
	if err != nil {
		return "", fmt.Errorf("db failure: %w", err)
	}

	keeperType, keeperConfig, err := s.getKeeperConfig(ctx, namespace.String(), sv.Keeper)
	if err != nil {
		return "", fmt.Errorf("get keeper config: %w", err)
	}

	// Decrypt from keeper.
	keeper, ok := s.keepers[keeperType]
	if !ok {
		return "", fmt.Errorf("could not find keeper: %s", keeperType)
	}
	return keeper.Expose(ctx, keeperConfig, namespace.String(), keepertypes.ExternalID(sv.ExternalID))
}

func (s *decryptStorage) getKeeperConfig(ctx context.Context, namespace string, name string) (keepertypes.KeeperType, secretv0alpha1.KeeperConfig, error) {
	// Check if keeper is default sql.
	if name == keepertypes.DefaultSQLKeeper {
		return keepertypes.SQLKeeperType, nil, nil
	}

	// Load keeper config from metadata store, or TODO: keeper cache.
	kp := &keeperDB{Namespace: namespace, Name: name}
	err := s.db.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		found, err := sess.Get(kp)
		if err != nil {
			return fmt.Errorf("failed to get row: %w", err)
		}
		if !found {
			return contracts.ErrKeeperNotFound
		}

		return nil
	})
	if err != nil {
		return "", nil, fmt.Errorf("db failure: %w", err)
	}

	keeperConfig := toProvider(kp.Type, kp.Payload)
	keeperType := toType(kp.Type)

	// TODO: this would be a good place to check if credentials are secure values and load them.

	return keeperType, keeperConfig, nil
}
