// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v1

// spec is the schema of our resource. The spec should include all the user-ediable information for the kind.
// status is where state and status information which may be used or updated by the operator or back-end should be placed
// If you do not have any such information, you do not need to include this field,
// however, as mentioned above, certain fields will be added by the kind system regardless.
//
//	status: {
//		currentState: string
//	}
//
// metadata if where kind- and schema-specific metadata goes. This is typically unused,
// as the kind system's common metadata is always part of `metadata` and covers most metadata use-cases.
//
//	metadata: {
//		kindSpecificField: string
//	}
//
// +k8s:openapi-gen=true
type FooSpec struct {
	// Example fields, make sure to use int32 or int64 types instead of int for Thema compatibility
	// secondField: int64
	FirstField string `json:"firstField"`
}

// NewFooSpec creates a new FooSpec object.
func NewFooSpec() *FooSpec {
	return &FooSpec{}
}
