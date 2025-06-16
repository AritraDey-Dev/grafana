// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type Query struct {
	QueryType         string            `json:"queryType"`
	RelativeTimeRange RelativeTimeRange `json:"relativeTimeRange"`
	DatasourceUID     DatasourceUID     `json:"datasourceUID"`
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
	From PromDurationWMillis `json:"from"`
	To   PromDurationWMillis `json:"to"`
}

// NewRelativeTimeRange creates a new RelativeTimeRange object.
func NewRelativeTimeRange() *RelativeTimeRange {
	return &RelativeTimeRange{}
}

// +k8s:openapi-gen=true
type PromDurationWMillis string

// TODO(@moustafab): validate regex for datasource UID
// +k8s:openapi-gen=true
type DatasourceUID string

// +k8s:openapi-gen=true
type Json map[string]interface{}

// +k8s:openapi-gen=true
type PromDuration string

// +k8s:openapi-gen=true
type NotificationSettings struct {
	Receiver            string                  `json:"receiver"`
	GroupBy             []string                `json:"groupBy,omitempty"`
	GroupWait           *string                 `json:"groupWait,omitempty"`
	GroupInterval       *string                 `json:"groupInterval,omitempty"`
	RepeatInterval      *string                 `json:"repeatInterval,omitempty"`
	MuteTimeIntervals   []MuteTimeIntervalRef   `json:"muteTimeIntervals,omitempty"`
	ActiveTimeIntervals []ActiveTimeIntervalRef `json:"activeTimeIntervals,omitempty"`
}

// NewNotificationSettings creates a new NotificationSettings object.
func NewNotificationSettings() *NotificationSettings {
	return &NotificationSettings{}
}

// TODO(@moustafab): validate regex for mute time interval ref
// +k8s:openapi-gen=true
type MuteTimeIntervalRef string

// TODO(@moustafab): validate regex for active time interval ref
// +k8s:openapi-gen=true
type ActiveTimeIntervalRef string

// =~ figure out the regex for the template string
// +k8s:openapi-gen=true
type TemplateString string

// +k8s:openapi-gen=true
type Spec struct {
	Title                       string                    `json:"title"`
	Paused                      *bool                     `json:"paused,omitempty"`
	Data                        map[string]Query          `json:"data"`
	Interval                    PromDuration              `json:"interval"`
	NoDataState                 string                    `json:"noDataState"`
	ExecErrState                string                    `json:"execErrState"`
	NotificationSettings        []NotificationSettings    `json:"notificationSettings,omitempty"`
	For                         string                    `json:"for"`
	KeepFiringFor               string                    `json:"keepFiringFor"`
	MissingSeriesEvalsToResolve *int64                    `json:"missingSeriesEvalsToResolve,omitempty"`
	Annotations                 map[string]TemplateString `json:"annotations"`
	DashboardUID                *string                   `json:"dashboardUID,omitempty"`
	Labels                      map[string]TemplateString `json:"labels"`
	PanelID                     *int64                    `json:"panelID,omitempty"`
}

// NewSpec creates a new Spec object.
func NewSpec() *Spec {
	return &Spec{
		NoDataState:  "NoData",
		ExecErrState: "Error",
	}
}
