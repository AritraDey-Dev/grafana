import { Field, NodeGraphDataFrameFieldNames, FieldConfigProperty, PanelPlugin } from '@grafana/data';

import { NodeGraphPanel } from './NodeGraphPanel';
import { ArcOptionsEditor } from './editor/ArcOptionsEditor';
import { RawFieldSelector } from './editor/RawFieldNameSelect';
import { NodeGraphSuggestionsSupplier } from './suggestions';
import { NodeGraphOptions } from './types';

export const plugin = new PanelPlugin<NodeGraphOptions>(NodeGraphPanel)
  .useFieldConfig({
    disableStandardOptions: Object.values(FieldConfigProperty).filter((v) => v !== FieldConfigProperty.Links),
  })
  .setPanelOptions((builder, context) => {
    builder.addSelect({
      name: 'Zoom mode',
      path: 'zoomMode',
      defaultValue: 'cooperative',
      settings: {
        options: [
          { value: 'cooperative', label: 'Cooperative', description: 'Lets you scroll the page normally' },
          { value: 'greedy', label: 'Greedy', description: 'Reacts to all zoom gestures' },
        ],
      },
    });
    builder.addNestedOptions({
      category: ['Nodes'],
      path: 'nodes',
      build: (builder) => {
        builder.addUnitPicker({
          name: 'Main stat unit',
          path: 'mainStatUnit',
        });
        builder.addUnitPicker({
          name: 'Secondary stat unit',
          path: 'secondaryStatUnit',
        });
        builder.addCustomEditor({
          name: 'Arc sections',
          path: 'arcs',
          id: 'arcs',
          editor: ArcOptionsEditor,
          settings: {
            filter:
              context.options?.nodeNameOverrides?.arc !== undefined
                ? (field: Field) => field.name.includes(context.options?.nodeNameOverrides?.arc || '')
                : undefined,
          },
        });
      },
    });
    builder.addNestedOptions({
      category: ['Edges'],
      path: 'edges',
      build: (builder) => {
        builder.addUnitPicker({
          name: 'Main stat unit',
          path: 'mainStatUnit',
        });
        builder.addUnitPicker({
          name: 'Secondary stat unit',
          path: 'secondaryStatUnit',
        });
      },
    });
    builder.addNestedOptions({
      category: ['Node field name overrides'],
      path: 'nodeNameOverrides',
      build: (builder) => {
        builder.addCustomEditor({
          name: 'Id',
          path: 'id',
          id: 'id',
          editor: RawFieldSelector,
          settings: { placeholder: NodeGraphDataFrameFieldNames.id },
        });
        builder.addCustomEditor({
          name: 'Title',
          path: 'title',
          id: 'title',
          editor: RawFieldSelector,
          settings: { placeholder: NodeGraphDataFrameFieldNames.title },
        });
        builder.addCustomEditor({
          name: 'Sub title',
          path: 'subTitle',
          id: 'subTitle',
          editor: RawFieldSelector,
          settings: { placeholder: NodeGraphDataFrameFieldNames.subTitle },
        });
        builder.addCustomEditor({
          name: 'Main stat',
          path: 'mainStat',
          id: 'mainStat',
          editor: RawFieldSelector,
          settings: { placeholder: NodeGraphDataFrameFieldNames.mainStat },
        });
        builder.addCustomEditor({
          name: 'Secondary stat',
          path: 'secondaryStat',
          id: 'secondaryStat',
          editor: RawFieldSelector,
          settings: { placeholder: NodeGraphDataFrameFieldNames.secondaryStat },
        });
        builder.addTextInput({
          name: 'Arc prefix',
          path: 'arc',
          settings: { placeholder: NodeGraphDataFrameFieldNames.arc },
        });
        builder.addTextInput({
          name: 'Details prefix',
          path: 'details',
          settings: { placeholder: NodeGraphDataFrameFieldNames.detail },
        });
        builder.addCustomEditor({
          name: 'Color',
          path: 'color',
          id: 'color',
          editor: RawFieldSelector,
          settings: { placeholder: NodeGraphDataFrameFieldNames.color },
        });
        builder.addCustomEditor({
          name: 'Icon',
          path: 'icon',
          id: 'icon',
          editor: RawFieldSelector,
          settings: { placeholder: NodeGraphDataFrameFieldNames.icon },
        });
        builder.addCustomEditor({
          name: 'Node radius',
          path: 'nodeRadius',
          id: 'nodeRadius',
          editor: RawFieldSelector,
          settings: { placeholder: NodeGraphDataFrameFieldNames.nodeRadius },
        });
        builder.addCustomEditor({
          name: 'Highlighted',
          path: 'highlighted',
          id: 'highlighted',
          editor: RawFieldSelector,
          settings: { placeholder: NodeGraphDataFrameFieldNames.highlighted },
        });
      },
    });
    builder.addNestedOptions({
      category: ['Edge field names overrides'],
      path: 'edgeNameOverrides',
      build: (builder) => {
        builder.addCustomEditor({
          name: 'Id',
          path: 'id',
          id: 'id',
          editor: RawFieldSelector,
          settings: { placeholder: NodeGraphDataFrameFieldNames.id },
        });
        builder.addCustomEditor({
          name: 'Main stat',
          path: 'mainStat',
          id: 'mainStat',
          editor: RawFieldSelector,
          settings: { placeholder: NodeGraphDataFrameFieldNames.mainStat },
        });
        builder.addCustomEditor({
          name: 'Secondary stat',
          path: 'secondaryStat',
          id: 'secondaryStat',
          editor: RawFieldSelector,
          settings: { placeholder: NodeGraphDataFrameFieldNames.secondaryStat },
        });
        builder.addTextInput({
          name: 'Details prefix',
          path: 'details',
          settings: { placeholder: NodeGraphDataFrameFieldNames.detail },
        });
        builder.addCustomEditor({
          name: 'Color',
          path: 'color',
          id: 'color',
          editor: RawFieldSelector,
          settings: { placeholder: NodeGraphDataFrameFieldNames.color },
        });
        builder.addCustomEditor({
          name: 'Target',
          path: 'target',
          id: 'target',
          editor: RawFieldSelector,
          settings: { placeholder: NodeGraphDataFrameFieldNames.target },
        });
        builder.addCustomEditor({
          name: 'Source',
          path: 'source',
          id: 'source',
          editor: RawFieldSelector,
          settings: { placeholder: NodeGraphDataFrameFieldNames.source },
        });
        builder.addCustomEditor({
          name: 'Highlighted',
          path: 'highlighted',
          id: 'highlighted',
          editor: RawFieldSelector,
          settings: { placeholder: NodeGraphDataFrameFieldNames.highlighted },
        });
        builder.addCustomEditor({
          name: 'Thickness',
          path: 'thickness',
          id: 'thickness',
          editor: RawFieldSelector,
          settings: { placeholder: NodeGraphDataFrameFieldNames.thickness },
        });
      },
    });
  })
  .setSuggestionsSupplier(new NodeGraphSuggestionsSupplier());
