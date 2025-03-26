import { css, cx } from '@emotion/css';
import * as React from 'react';

import {
  DataTransformerID,
  KeyValue,
  standardTransformers,
  TransformerRegistryItem,
  TransformerUIProps,
  getFieldDisplayName,
  stringToJsRegex,
  TransformerCategory,
  SelectableValue,
  GrafanaTheme2,
} from '@grafana/data';
import { FilterFieldsByNameTransformerOptions } from '@grafana/data/src/transformations/transformers/filterByName';
import { getTemplateSrv } from '@grafana/runtime/src/services';
import { Input, FilterPill, InlineFieldRow, InlineField, InlineSwitch, Select, Checkbox } from '@grafana/ui';
import { config } from 'app/core/config';

import { getTransformationContent } from '../docs/getTransformationContent';

interface FilterByNameTransformerEditorProps extends TransformerUIProps<FilterFieldsByNameTransformerOptions> {}

interface FilterByNameTransformerEditorState {
  include: string[];
  options: FieldNameInfo[];
  selected: string[];
  regex?: string;
  variable?: string;
  variables: SelectableValue[];
  byVariable: boolean;
  isRegexValid?: boolean;
}

interface FieldNameInfo {
  name: string;
  count: number;
}
export class FilterByNameTransformerEditor extends React.PureComponent<
  FilterByNameTransformerEditorProps,
  FilterByNameTransformerEditorState
> {
  constructor(props: FilterByNameTransformerEditorProps) {
    super(props);
    this.state = {
      include: props.options.include?.names || [],
      regex: props.options.include?.pattern,
      variable: props.options.include?.variable,
      byVariable: props.options.byVariable || false,
      options: [],
      variables: [],
      selected: [],
      isRegexValid: true,
    };
  }

  componentDidMount() {
    this.initOptions();
  }

  componentDidUpdate(oldProps: FilterByNameTransformerEditorProps) {
    if (this.props.input !== oldProps.input) {
      this.initOptions();
    }
  }

  private initOptions() {
    const { input, options } = this.props;
    const configuredOptions = Array.from(options.include?.names ?? []);

    const variables = getTemplateSrv()
      .getVariables()
      .map((v) => ({ label: '$' + v.name, value: '$' + v.name }));
    const allNames: FieldNameInfo[] = [];
    const byName: KeyValue<FieldNameInfo> = {};

    for (const frame of input) {
      for (const field of frame.fields) {
        const displayName = getFieldDisplayName(field, frame, input);
        let v = byName[displayName];

        if (!v) {
          v = byName[displayName] = {
            name: displayName,
            count: 0,
          };
          allNames.push(v);
        }

        v.count++;
      }
    }

    if (options.include?.pattern) {
      try {
        const regex = stringToJsRegex(options.include.pattern);

        for (const info of allNames) {
          if (regex.test(info.name)) {
            configuredOptions.push(info.name);
          }
        }
      } catch (error) {
        console.error(error);
      }
    }

    if (configuredOptions.length) {
      const selected: FieldNameInfo[] = allNames.filter((n) => configuredOptions.includes(n.name));

      this.setState({
        options: allNames,
        selected: selected.map((s) => s.name),
        variables: variables,
        byVariable: options.byVariable || false,
        variable: options.include?.variable,
        regex: options.include?.pattern,
      });
    } else {
      this.setState({
        options: allNames,
        selected: allNames.map((n) => n.name),
        variables: variables,
        byVariable: options.byVariable || false,
        variable: options.include?.variable,
        regex: options.include?.pattern,
      });
    }
  }

  onFieldToggle = (fieldName: string) => {
    const { selected } = this.state;
    if (selected.indexOf(fieldName) > -1) {
      this.onChange(selected.filter((s) => s !== fieldName));
    } else {
      this.onChange([...selected, fieldName]);
    }
  };

  onChange = (selected: string[]) => {
    const { regex, isRegexValid } = this.state;
    const options: FilterFieldsByNameTransformerOptions = {
      ...this.props.options,
      include: { names: selected },
    };

    if (regex && isRegexValid) {
      options.include = options.include ?? {};
      options.include.pattern = regex;
    }

    this.setState({ selected }, () => {
      this.props.onChange(options);
    });
  };

  onInputBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const { selected, regex } = this.state;
    let isRegexValid = true;

    try {
      if (regex) {
        stringToJsRegex(regex);
      }
    } catch (e) {
      isRegexValid = false;
    }

    if (isRegexValid) {
      this.props.onChange({
        ...this.props.options,
        include: { pattern: regex },
      });
    } else {
      this.props.onChange({
        ...this.props.options,
        include: { names: selected },
      });
    }

    this.setState({ isRegexValid });
  };

  onVariableChange = (selected: SelectableValue) => {
    this.props.onChange({
      ...this.props.options,
      include: { variable: selected.value },
    });

    this.setState({ variable: selected.value });
  };

  onFromVariableChange = (e: React.FormEvent<HTMLInputElement>) => {
    const val = e.currentTarget.checked;
    this.props.onChange({ ...this.props.options, byVariable: val });
    this.setState({ byVariable: val });
  };

  onToggleSelectAll = () => {
    this.onChange(
      this.state.selected.length === this.state.options.length ? [] : this.state.options.map((o) => o.name)
    );
  };

  render() {
    const { options, selected, isRegexValid } = this.state;
    const styles = getStyles(config.theme2);
    const allChecked = selected.length === options.length;

    return (
      <div>
        <InlineFieldRow label="Use variable">
          <InlineField label="From variable">
            <InlineSwitch value={this.state.byVariable} onChange={this.onFromVariableChange}></InlineSwitch>
          </InlineField>
        </InlineFieldRow>

        {this.state.byVariable ? (
          <InlineFieldRow>
            <InlineField label="Variable">
              <Select
                value={this.state.variable}
                onChange={this.onVariableChange}
                options={this.state.variables || []}
              ></Select>
            </InlineField>
          </InlineFieldRow>
        ) : (
          <InlineFieldRow label="Identifier">
            <div className={cx(styles.fieldNameOptions, styles.fullWidth)}>
              <InlineField
                label="Identifier"
                invalid={!isRegexValid}
                error={!isRegexValid ? 'Invalid pattern' : undefined}
              >
                <Input
                  placeholder="Regular expression pattern"
                  value={this.state.regex || ''}
                  onChange={(e) => this.setState({ regex: e.currentTarget.value })}
                  onBlur={this.onInputBlur}
                  width={25}
                />
              </InlineField>
              <Checkbox
                value={allChecked}
                label={allChecked ? `${selected.length} selected` : 'Select all'}
                description={
                  allChecked ? 'Remove all fields from the visualization' : 'Add all fields to the visualization'
                }
                onChange={this.onToggleSelectAll}
              />
            </div>
            <div className={styles.fieldNameOptions}>
              {options.map((o, i) => {
                const label = `${o.name}${o.count > 1 ? ' (' + o.count + ')' : ''}`;
                const isSelected = selected.indexOf(o.name) > -1;
                return (
                  <FilterPill
                    key={`${o.name}/${i}`}
                    onClick={() => {
                      this.onFieldToggle(o.name);
                    }}
                    label={label}
                    selected={isSelected}
                  />
                );
              })}
            </div>
          </InlineFieldRow>
        )}
      </div>
    );
  }
}

export const filterFieldsByNameTransformRegistryItem: TransformerRegistryItem<FilterFieldsByNameTransformerOptions> = {
  id: DataTransformerID.filterFieldsByName,
  editor: FilterByNameTransformerEditor,
  transformation: standardTransformers.filterFieldsByNameTransformer,
  name: standardTransformers.filterFieldsByNameTransformer.name,
  description: 'Removes part of the query results using a regex pattern. The pattern can be inclusive or exclusive.',
  categories: new Set([TransformerCategory.Filter]),
  help: getTransformationContent(DataTransformerID.filterFieldsByName).helperDocs,
};

function getStyles(theme: GrafanaTheme2) {
  return {
    fieldNameOptions: css({
      display: 'flex',
    }),
    fullWidth: css({
      width: '100%',
      gap: theme.spacing(2),
    }),
  };
}
