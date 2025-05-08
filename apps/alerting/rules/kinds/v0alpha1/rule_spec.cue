package v0alpha1

import "time"

TemplateString: string // TODO(moustafab): better typing?

#RuleSpec: {
	title:   string
	paused?: bool
	data: {
		[string]: #Query
	}
	interval: time.Duration // TODO(moustafab): ensuring this converts to a valid duration may need to be done elsewhere for now
	labels: {
		[string]: TemplateString
	}
	...
}

#Json: {
  [string]: #Json | [...#Json] | string | bool | number | null
}

#RelativeTimeRange: {
	from: time.Duration
	to:   time.Duration
}

#Query: {
	queryType:         string
	relativeTimeRange: #RelativeTimeRange
	datasourceUID:     string
	model:             #Json
	source?:           bool
}
