import { escapeRegExp } from 'lodash';

import { SelectableValue } from '@grafana/data';

import {
  BuilderQueryExpression,
  BuilderQueryEditorExpressionType,
  BuilderQueryEditorPropertyType,
  BuilderQueryEditorOperatorType,
} from '../../dataquery.gen';
import { QueryEditorPropertyType } from '../../types';

const DYNAMIC_TYPE_ARRAY_DELIMITER = '["`indexer`"]';

export const valueToDefinition = (name: string) => {
  return {
    value: name,
    label: name.replace(new RegExp(escapeRegExp(DYNAMIC_TYPE_ARRAY_DELIMITER), 'g'), '[ ]'),
  };
};

export const DEFAULT_LOGS_BUILDER_QUERY: BuilderQueryExpression = {
  columns: { columns: [], type: BuilderQueryEditorExpressionType.Property },
  from: {
    type: BuilderQueryEditorExpressionType.Property,
    property: { type: BuilderQueryEditorPropertyType.String, name: '' },
  },
  groupBy: { expressions: [], type: BuilderQueryEditorExpressionType.Group_by },
  reduce: { expressions: [], type: BuilderQueryEditorExpressionType.Reduce },
  where: { expressions: [], type: BuilderQueryEditorExpressionType.And },
};

export const OPERATORS_BY_TYPE: Record<string, Array<SelectableValue<string>>> = {
  string: [
    { label: '==', value: '==' },
    { label: '!=', value: '!=' },
    { label: 'contains', value: 'contains' },
    { label: '!contains', value: '!contains' },
    { label: 'startswith', value: 'startswith' },
    { label: 'endswith', value: 'endswith' },
  ],
  int: [
    { label: '==', value: '==' },
    { label: '!=', value: '!=' },
    { label: '>', value: '>' },
    { label: '<', value: '<' },
    { label: '>=', value: '>=' },
    { label: '<=', value: '<=' },
  ],
  datetime: [
    { label: 'before', value: '<' },
    { label: 'after', value: '>' },
    { label: 'between', value: 'between' },
  ],
  bool: [
    { label: '==', value: '==' },
    { label: '!=', value: '!=' },
  ],
};

export const toOperatorOptions = (type: string): Array<SelectableValue<string>> => {
  return OPERATORS_BY_TYPE[type] || OPERATORS_BY_TYPE.string;
};

export interface QueryEditorPropertyDefinition {
  value: string;
  type: QueryEditorPropertyType;
  label?: string;
  dynamic?: boolean;
}

export const columnsToDefinition = (columns: SelectableValue<string>): QueryEditorPropertyDefinition[] => {
  if (!Array.isArray(columns)) {
    return [];
  }

  return columns.map((column) => {
    return {
      value: column.name,
      label: column.name.replace(new RegExp(escapeRegExp(DYNAMIC_TYPE_ARRAY_DELIMITER), 'g'), '[ ]'),
      type: toPropertyType(column.type),
    };
  });
};

export const toPropertyType = (kustoType: string): QueryEditorPropertyType => {
  switch (kustoType) {
    case 'real':
    case 'int':
    case 'long':
    case 'double':
    case 'decimal':
      return QueryEditorPropertyType.Number;
    case 'datetime':
      return QueryEditorPropertyType.DateTime;
    case 'bool':
      return QueryEditorPropertyType.Boolean;
    case 'timespan':
      return QueryEditorPropertyType.TimeSpan;
    default:
      return QueryEditorPropertyType.String;
  }
};

export const parseQueryToBuilder = (query: string): BuilderQueryExpression => {
  const expression: BuilderQueryExpression = {
    columns: { columns: [], type: BuilderQueryEditorExpressionType.Property },
    from: undefined,
    groupBy: { expressions: [], type: BuilderQueryEditorExpressionType.Group_by },
    reduce: { expressions: [], type: BuilderQueryEditorExpressionType.Reduce },
    where: { expressions: [], type: BuilderQueryEditorExpressionType.And },
  };

  const lines = query.split('\n');

  lines.forEach((line, index) => {
    if (index === 0 && !line.startsWith('|')) {
      const tableName = line.trim();
      expression.from = {
        property: { name: tableName, type: BuilderQueryEditorPropertyType.String },
        type: BuilderQueryEditorExpressionType.Property,
      };
    } else if (line.startsWith('| from ')) {
      const tableName = line.replace('| from ', '').trim();
      expression.from = {
        property: { name: tableName, type: BuilderQueryEditorPropertyType.String },
        type: BuilderQueryEditorExpressionType.Property,
      };
    }

    if (line.startsWith('| project ')) {
      const columns = line
        .replace('| project ', '')
        .split(',')
        .map((col) => col.trim());
      expression.columns = {
        columns,
        type: BuilderQueryEditorExpressionType.Property,
      };
    }

    if (line.startsWith('| where ')) {
      const conditions = line.replace('| where ', '').split(' and ');
      expression.where = {
        type: BuilderQueryEditorExpressionType.And,
        expressions: conditions.map((condition) => {
          const [property, operator, value] = condition.split(/\s+/);

          let parsedValue: BuilderQueryEditorOperatorType;

          if (value === 'true' || value === 'false') {
            parsedValue = value === 'true';
          } else if (!isNaN(Number(value))) {
            parsedValue = Number(value);
          } else {
            parsedValue = value;
          }

          return {
            property: { name: property, type: BuilderQueryEditorPropertyType.String },
            operator: { name: operator, value: parsedValue },
            type: BuilderQueryEditorExpressionType.Operator,
          };
        }),
      };
    }

    if (line.startsWith('| summarize ')) {
      const summarizeParts = line.replace('| summarize ', '').split('by');
      const aggregationPart = summarizeParts[0].trim();
      const groupByPart = summarizeParts[1]?.trim();

      const aggregationExpressions = aggregationPart.split(',').map((agg) => {
        return {
          reduce: { name: agg.trim(), type: BuilderQueryEditorPropertyType.Function },
          property: { name: '', type: BuilderQueryEditorPropertyType.String },
        };
      });

      if (!expression.reduce) {
        expression.reduce = { expressions: [], type: BuilderQueryEditorExpressionType.Reduce };
      }

      expression.reduce.expressions = aggregationExpressions;

      if (groupByPart) {
        const groupByColumns = groupByPart.split(',').map((col) => col.trim());
        expression.groupBy = {
          type: BuilderQueryEditorExpressionType.Group_by,
          expressions: groupByColumns.map((col) => ({
            property: { name: col, type: BuilderQueryEditorPropertyType.String },
            type: BuilderQueryEditorExpressionType.Group_by,
          })),
        };
      }
    }

    // Handle limit clause
    if (line.startsWith('| limit ')) {
      const limitValue = parseInt(line.replace('| limit ', '').trim(), 10);
      if (!isNaN(limitValue)) {
        expression.limit = limitValue;
      }
    }
  });

  return expression;
};

export const getAggregations = (reduceExpressions: any[] = []) => {
  return reduceExpressions
    .map((agg) => {
      if (agg.reduce?.name === 'count()' && agg.property?.name === '') {
        return 'count()';
      }

      if (agg.reduce?.name === 'count()') {
        return `count(${agg.property?.name})`;
      }

      if (agg.property?.name === '') {
        return `${agg.reduce.name}`;
      } else {
        return `${agg.reduce.name}(${agg.property?.name})`;
      }
    })
    .join(', ');
};

export const getFilters = (whereExpressions: any[] = []) => {
  return whereExpressions
    .map((exp) => {
      if ('property' in exp && exp.property?.name && exp.operator?.name && exp.operator?.value !== undefined) {
        return `${exp.property.name} ${exp.operator.name} ${exp.operator.value}`;
      }
      return null;
    })
    .filter((filter) => filter !== null)
    .join(' and ');
};
