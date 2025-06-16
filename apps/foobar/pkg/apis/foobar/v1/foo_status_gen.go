// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v1

// +k8s:openapi-gen=true
type FoostatusOperatorState struct {
	// lastEvaluation is the ResourceVersion last evaluated
	LastEvaluation string `json:"lastEvaluation"`
	// state describes the state of the lastEvaluation.
	// It is limited to three possible states for machine evaluation.
	State FooStatusOperatorStateState `json:"state"`
	// descriptiveState is an optional more descriptive state field which has no requirements on format
	DescriptiveState *string `json:"descriptiveState,omitempty"`
	// details contains any extra information that is operator-specific
	Details map[string]interface{} `json:"details,omitempty"`
}

// NewFoostatusOperatorState creates a new FoostatusOperatorState object.
func NewFoostatusOperatorState() *FoostatusOperatorState {
	return &FoostatusOperatorState{}
}

// +k8s:openapi-gen=true
type FooStatus struct {
	// operatorStates is a map of operator ID to operator state evaluations.
	// Any operator which consumes this kind SHOULD add its state evaluation information to this field.
	OperatorStates map[string]FoostatusOperatorState `json:"operatorStates,omitempty"`
	// additionalFields is reserved for future use
	AdditionalFields map[string]interface{} `json:"additionalFields,omitempty"`
}

// NewFooStatus creates a new FooStatus object.
func NewFooStatus() *FooStatus {
	return &FooStatus{}
}

// +k8s:openapi-gen=true
type FooStatusOperatorStateState string

const (
	FooStatusOperatorStateStateSuccess    FooStatusOperatorStateState = "success"
	FooStatusOperatorStateStateInProgress FooStatusOperatorStateState = "in_progress"
	FooStatusOperatorStateStateFailed     FooStatusOperatorStateState = "failed"
)
