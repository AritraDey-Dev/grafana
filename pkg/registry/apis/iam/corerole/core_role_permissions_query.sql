SELECT p.action, p.scope
  FROM {{ .Ident .PermissionTable }} as p
 WHERE p.role_id = {{ .Arg .Query.RoleID }}