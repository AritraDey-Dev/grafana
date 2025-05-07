package v0alpha1

// TODO(rwwiv): figure out generation for this dir

TemplateString: string // TODO(moustafab): better typing?

// can not be empty, can not be a repeat (already met by using a map)
DataRef: string & !=""

#RuleSpec: {
	title:   string
	paused?: bool
	data: {
		[DataRef]: #Query
	} & {
		len(data) >= 1
	}
	interval: string // TODO(moustafab): duration (min: 1s, max: heat death of universe)
	labels: {
		[string]: TemplateString
	}
	...
}

#NestedJSON: {
  [string]: #NestedJSON | [#NestedJSON] | string | bool | number | null
}

#RelativeTimeRange: {
	from: string // TODO(moustafab): duration
	to:   string // ^
}

#Query: {
	queryType:         string
	relativeTimeRange: #RelativeTimeRange
	datasourceUID:     string
	model:             #NestedJSON
	source?:           bool
}
