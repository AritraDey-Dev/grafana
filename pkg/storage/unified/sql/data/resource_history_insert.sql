INSERT INTO {{ .Ident "resource_history" }}
    (
        {{ .Ident "guid" }},
        {{ .Ident "group" }},
        {{ .Ident "resource" }},
        {{ .Ident "namespace" }},
        {{ .Ident "name" }},
        {{ .Ident "folder" }},

        {{ .Ident "previous_resource_version"}},
        {{ .Ident "value" }},
        {{ .Ident "action" }},

        {{ .Ident "message" }},
        {{ .Ident "timestamp" }}
    )

    VALUES (
        {{ .Arg .GUID }},
        {{ .Arg .WriteEvent.Key.Group }},
        {{ .Arg .WriteEvent.Key.Resource }},
        {{ .Arg .WriteEvent.Key.Namespace }},
        {{ .Arg .WriteEvent.Key.Name }},
        {{ .Arg .Folder }},

        {{ .Arg .WriteEvent.PreviousRV }},
        {{ .Arg .WriteEvent.Value }},
        {{ .Arg .WriteEvent.Type }},

        {{ .Arg .Message }},
        {{ .Arg .Timestamp }}
    )
;
