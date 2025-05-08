package v0alpha1

import "time"

NoDataState:  *"NoData" | "Ok" | "Alerting" | "KeepLast"
ExecErrState: *"Error" | "Ok" | "Alerting" | "KeepLast"

AlertRuleSpec: #RuleSpec & {
	noDataState:  NoDataState
	execErrState: ExecErrState
	notificationSettings?: [...#NotificationSettings]
	"for":                        string & #PromDuration
	missingSeriesEvalsToResolve?: int
	annotations: {
		[string]: TemplateString
	}
}

#NotificationSettings: {
	receiver: string
	groupBy?: [...string]
	groupWait?:      string
	groupInterval?:  string
	repeatInterval?: string
	muteTimeIntervals?: [...#MuteTimeIntervalRef]
}
