package v0alpha1

NoDataState:  *'NoData' | 'Ok' | 'Alerting' | 'KeepLast'
ExecErrState: *'Error' | 'Ok' | 'Alerting' | 'KeepLast'

AlertRuleSpec: #RuleSpec & {
	noDataState:  NoDataState
	execErrState: ExecErrState
	notificationSettings?: [...#NotificationSettings]
	missingSeriesEvalsToResolve?: int
	"for":                        string // TODO(moustafab): duration
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
	muteTimeIntervals?: [...string] // TODO(moustafab): ref to other type?
}
