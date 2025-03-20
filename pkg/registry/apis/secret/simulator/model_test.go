package simulator

import (
	"context"
	"fmt"
	"testing"

	secretv0alpha1 "github.com/grafana/grafana/pkg/apis/secret/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/mohae/deepcopy"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"
)

// Model is a simplified version of the system.
// It represents some of the behaviors allowed.
type Model struct {
	secrets map[Namespace]map[SecureValueName]bool
}

func NewModel() *Model {
	return &Model{
		secrets: make(map[Namespace]map[SecureValueName]bool),
	}
}

func (model *Model) Create(
	ctx context.Context,
	obj runtime.Object,
	createValidation rest.ValidateObjectFunc,
	options *metav1.CreateOptions,
) (runtime.Object, error) {
	sv, ok := obj.(*secretv0alpha1.SecureValue)
	if !ok {
		return nil, fmt.Errorf("expected SecureValue for create")
	}

	if ns, ok := model.secrets[sv.Namespace]; ok {
		if _, ok := ns[sv.Name]; ok {
			return nil, contracts.ErrSecureValueAlreadyExists
		}
	}

	if _, ok := model.secrets[sv.Namespace]; !ok {
		model.secrets[sv.Namespace] = make(map[SecureValueName]bool)
	}

	model.secrets[sv.Namespace][sv.Name] = true

	return nil, nil
}

func TestFoo(t *testing.T) {
	type Foo struct {
		x int
		m map[string]string
	}

	original := &Foo{x: 1, m: map[string]string{"hello": "world"}}
	copy := deepcopy.Copy(original)

	require.Equal(t, original, copy)
}

func TestCreate(t *testing.T) {
	t.Run("secret names are unique per namespace", func(t *testing.T) {
		t.Parallel()

		model := NewModel()

		ctx := context.Background()
		sv := &secretv0alpha1.SecureValue{
			ObjectMeta: metav1.ObjectMeta{
				Name: "sv-1",
			},
			Spec: secretv0alpha1.SecureValueSpec{
				Title: "foo",
				Value: secretv0alpha1.NewExposedSecureValue("value1"),
			},
			Status: secretv0alpha1.SecureValueStatus{
				Phase: secretv0alpha1.SecureValuePhasePending,
			},
		}
		validateObjectFunc := func(ctx context.Context, obj runtime.Object) error {
			return nil
		}
		createOptions := &metav1.CreateOptions{}

		// Create the secure value metadata
		_, err := model.Create(ctx, sv, validateObjectFunc, createOptions)
		require.NoError(t, err)

		// Try to create the secure value metadata with the same namespace and name combination
		_, err = model.Create(ctx, sv, validateObjectFunc, createOptions)
		require.ErrorIs(t, err, contracts.ErrSecureValueAlreadyExists)
	})
}
