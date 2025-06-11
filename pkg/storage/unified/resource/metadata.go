package resource

import (
	"context"
	"encoding/json"
	"fmt"
	"iter"
	"strings"

	"github.com/google/uuid"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

const (
	prefixMeta = "/unified/meta"
)

// Metadata store
type MetaData struct {
	Namespace string `json:"namespace,omitempty"`
	Folder    string `json:"folder,omitempty"`
	Deleted   bool   `json:"deleted"`
}

type MetaDataObj struct {
	Key   resourcepb.ResourceKey
	UID   uuid.UUID
	Value MetaData
}

type metadataStore struct {
	kv KV
}

func newMetadataStore(kv KV) *metadataStore {
	return &metadataStore{
		kv: kv,
	}
}

func (d *metadataStore) getKey(key resourcepb.ResourceKey, uid uuid.UUID) string {
	return fmt.Sprintf("%s/%s/%s/%s/%s/%s", prefixMeta, key.Group, key.Resource, key.Namespace, key.Name, uid.String())
}

func (d *metadataStore) parseKey(key string) (resourcepb.ResourceKey, uuid.UUID, error) {
	if !strings.HasPrefix(key, prefixMeta+"/") {
		return resourcepb.ResourceKey{}, uuid.UUID{}, fmt.Errorf("invalid key: %s", key)
	}
	key = strings.TrimPrefix(key, prefixMeta+"/")

	parts := strings.Split(key, "/")
	if len(parts) < 4 {
		return resourcepb.ResourceKey{}, uuid.UUID{}, fmt.Errorf("invalid key: %s", key)
	}
	uid, err := uuid.Parse(parts[4])
	if err != nil {
		return resourcepb.ResourceKey{}, uuid.UUID{}, fmt.Errorf("invalid uuid: %s", uid)
	}
	return resourcepb.ResourceKey{
		Namespace: parts[2],
		Group:     parts[0],
		Resource:  parts[1],
		Name:      parts[3],
	}, uid, nil
}

func (d *metadataStore) getPrefix(key resourcepb.ResourceKey) (string, error) {
	if key.Namespace == "" || key.Group == "" || key.Resource == "" {
		return "", fmt.Errorf("namespace, group, and resource are required")
	}
	if key.Name == "" {
		return fmt.Sprintf("%s/%s/%s/%s/", prefixMeta, key.Group, key.Resource, key.Namespace), nil
	}
	return fmt.Sprintf("%s/%s/%s/%s/%s/", prefixMeta, key.Group, key.Resource, key.Namespace, key.Name), nil
}

func (d *metadataStore) Get(ctx context.Context, key resourcepb.ResourceKey, uid uuid.UUID) (MetaData, error) {
	obj, err := d.kv.Get(ctx, d.getKey(key, uid))
	if err != nil {
		return MetaData{}, err
	}
	var meta MetaData
	if err := json.Unmarshal(obj.Value, &meta); err != nil {
		return meta, err
	}
	return meta, nil
}

func (d *metadataStore) GetLatest(ctx context.Context, key resourcepb.ResourceKey) (MetaDataObj, error) {
	if key.Namespace == "" {
		return MetaDataObj{}, fmt.Errorf("namespace is required")
	}
	if key.Group == "" {
		return MetaDataObj{}, fmt.Errorf("group is required")
	}
	if key.Resource == "" {
		return MetaDataObj{}, fmt.Errorf("resource is required")
	}
	if key.Name == "" {
		return MetaDataObj{}, fmt.Errorf("name is required")
	}

	prefix, err := d.getPrefix(key)
	if err != nil {
		return MetaDataObj{}, err
	}
	for k, err := range d.kv.List(ctx, ListOptions{
		StartKey: prefix,
		EndKey:   PrefixRangeEnd(prefix),
		Sort:     SortOrderDesc,
		Limit:    1,
	}) {
		if err != nil {
			return MetaDataObj{}, err
		}
		metaObj, err := d.kv.Get(ctx, k)
		if err != nil {
			return MetaDataObj{}, err
		}
		var meta MetaData
		if err := json.Unmarshal(metaObj.Value, &meta); err != nil {
			return MetaDataObj{}, err
		}
		if meta.Deleted {
			return MetaDataObj{}, ErrNotFound
		}
		_, uid, err := d.parseKey(k)
		if err != nil {
			return MetaDataObj{}, err
		}
		return MetaDataObj{
			Key: resourcepb.ResourceKey{
				Namespace: key.Namespace,
				Group:     key.Group,
				Resource:  key.Resource,
				Name:      key.Name,
			},
			UID:   uid,
			Value: meta,
		}, nil
	}
	return MetaDataObj{}, fmt.Errorf("no latest version found")
}

func (d *metadataStore) List(ctx context.Context, key resourcepb.ResourceKey) iter.Seq2[MetaDataObj, error] {
	prefix, err := d.getPrefix(key)
	if err != nil {
		return func(yield func(MetaDataObj, error) bool) {
			yield(MetaDataObj{}, err)
		}
	}
	iter := d.kv.List(ctx, ListOptions{
		StartKey: prefix,
		EndKey:   PrefixRangeEnd(prefix),
	})
	return func(yield func(MetaDataObj, error) bool) {
		for k, err := range iter {
			if err != nil {
				yield(MetaDataObj{}, err)
				return
			}
			metaObj, err := d.kv.Get(ctx, k)
			if err != nil {
				yield(MetaDataObj{}, err)
				return
			}
			var meta MetaData
			if err := json.Unmarshal(metaObj.Value, &meta); err != nil {
				yield(MetaDataObj{}, err)
				return
			}
			k, uid, err := d.parseKey(k)
			if err != nil {
				yield(MetaDataObj{}, err)
				return
			}
			yield(MetaDataObj{
				Key: resourcepb.ResourceKey{
					Namespace: k.Namespace,
					Group:     k.Group,
					Resource:  k.Resource,
					Name:      k.Name,
				},
				UID:   uid,
				Value: meta,
			}, nil)
		}
	}
}

func (d *metadataStore) Save(ctx context.Context, obj MetaDataObj) error {
	valueBytes, err := json.Marshal(obj.Value)
	if err != nil {
		return err
	}
	return d.kv.Save(ctx, d.getKey(obj.Key, obj.UID), valueBytes, SaveOptions{})
}
