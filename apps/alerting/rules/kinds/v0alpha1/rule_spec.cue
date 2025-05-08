package v0alpha1

TemplateString: string // TODO(moustafab): better typing?

#RuleSpec: {
	title:   string
	paused?: bool
	data: {
		[string]: #Query
	}
	interval: string // TODO(moustafab): duration (min: 1s, max: heat death of universe)
	labels: {
		[string]: TemplateString
	}
	...
}

#Json: {
  [string]: #Json | [...#Json] | string | bool | number | null
}

#RelativeTimeRange: {
	from: string // TODO(moustafab): duration
	to:   string // ^
}

#Query: {
	queryType:         string
	relativeTimeRange: #RelativeTimeRange
	datasourceUID:     string
	model:             #Json
	source?:           bool
}
