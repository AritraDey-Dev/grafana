// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type Query struct {
	QueryType         string            `json:"queryType"`
	RelativeTimeRange RelativeTimeRange `json:"relativeTimeRange"`
	DatasourceUID     string            `json:"datasourceUID"`
	Model             Json              `json:"model"`
	Source            *bool             `json:"source,omitempty"`
}

// NewQuery creates a new Query object.
func NewQuery() *Query {
	return &Query{
		RelativeTimeRange: *NewRelativeTimeRange(),
	}
}

// +k8s:openapi-gen=true
type RelativeTimeRange struct {
	From Duration `json:"from"`
	To   Duration `json:"to"`
}

// NewRelativeTimeRange creates a new RelativeTimeRange object.
func NewRelativeTimeRange() *RelativeTimeRange {
	return &RelativeTimeRange{}
}

// +k8s:openapi-gen=true
type Duration string

// +k8s:openapi-gen=true
type Json map[string]*JsonOrArrayOfJsonOrStringOrBoolOrFloat64OrNull

// +k8s:openapi-gen=true
type NotificationSettings struct {
	Receiver       string   `json:"receiver"`
	GroupBy        []string `json:"groupBy,omitempty"`
	GroupWait      *string  `json:"groupWait,omitempty"`
	GroupInterval  *string  `json:"groupInterval,omitempty"`
	RepeatInterval *string  `json:"repeatInterval,omitempty"`
	// TODO(moustafab): ref to other type?
	MuteTimeIntervals []string `json:"muteTimeIntervals,omitempty"`
}

// NewNotificationSettings creates a new NotificationSettings object.
func NewNotificationSettings() *NotificationSettings {
	return &NotificationSettings{}
}

// TODO(moustafab): better typing?
// +k8s:openapi-gen=true
type TemplateString string

// +k8s:openapi-gen=true
type Spec struct {
	Title  string           `json:"title"`
	Paused *bool            `json:"paused,omitempty"`
	Data   map[string]Query `json:"data"`
	// TODO(moustafab): ensuring this converts to a valid duration may need to be done elsewhere for now
	Interval                    Duration                  `json:"interval"`
	NoDataState                 string                    `json:"noDataState"`
	ExecErrState                string                    `json:"execErrState"`
	NotificationSettings        []NotificationSettings    `json:"notificationSettings,omitempty"`
	For                         string                    `json:"for"`
	MissingSeriesEvalsToResolve *int64                    `json:"missingSeriesEvalsToResolve,omitempty"`
	Labels                      map[string]TemplateString `json:"labels"`
	Annotations                 map[string]TemplateString `json:"annotations"`
}

// NewSpec creates a new Spec object.
func NewSpec() *Spec {
	return &Spec{
		NoDataState:  "NoData",
		ExecErrState: "Error",
	}
}

// +k8s:openapi-gen=true
type JsonOrArrayOfJsonOrStringOrBoolOrFloat64OrNull struct {
	Json        *Json    `json:"Json,omitempty"`
	ArrayOfJson []Json   `json:"ArrayOfJson,omitempty"`
	String      *string  `json:"String,omitempty"`
	Bool        *bool    `json:"Bool,omitempty"`
	Float64     *float64 `json:"Float64,omitempty"`
}

// NewJsonOrArrayOfJsonOrStringOrBoolOrFloat64OrNull creates a new JsonOrArrayOfJsonOrStringOrBoolOrFloat64OrNull object.
func NewJsonOrArrayOfJsonOrStringOrBoolOrFloat64OrNull() *JsonOrArrayOfJsonOrStringOrBoolOrFloat64OrNull {
	return &JsonOrArrayOfJsonOrStringOrBoolOrFloat64OrNull{}
}
