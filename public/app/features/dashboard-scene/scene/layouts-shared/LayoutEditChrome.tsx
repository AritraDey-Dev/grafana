import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { ControlsLabel } from '@grafana/scenes';
import { useStyles2, Select, Stack } from '@grafana/ui';

import { getDashboardSceneFor } from '../../utils/utils';
import { DashboardLayoutManager, isLayoutParent, LayoutRegistryItem } from '../types';

import { layoutRegistry } from './layoutRegistry';

interface Props {
  layoutManager: DashboardLayoutManager;
  children: React.ReactNode;
  onClick?: React.MouseEventHandler<HTMLDivElement>;
}

export function LayoutEditChrome({ layoutManager, children, onClick }: Props) {
  const styles = useStyles2(getStyles);
  const { isEditing } = getDashboardSceneFor(layoutManager).useState();

  const layouts = layoutRegistry.list();
  const options = layouts.map((layout) => ({
    label: layout.name,
    value: layout,
  }));

  const currentLayoutId = layoutManager.getDescriptor().id;
  const currentLayoutOption = options.find((option) => option.value.id === currentLayoutId);

  return (
    <div className={styles.wrapper} onClick={onClick}>
      {isEditing && (
        <div className={styles.editHeader}>
          <Stack gap={0}>
            <ControlsLabel label="Layout type" />
            <Select
              options={options}
              value={currentLayoutOption}
              onChange={(option) => changeLayoutTo(layoutManager, option.value!)}
            />
          </Stack>
          {layoutManager.renderEditor?.()}
        </div>
      )}
      {children}
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    editHeader: css({
      width: '100%',
      display: 'flex',
      gap: theme.spacing(1),
      padding: theme.spacing(0, 1, 0.5, 0),
      margin: theme.spacing(0, 0, 1, 0),
      alignItems: 'flex-end',
      borderBottom: `1px solid ${theme.colors.border.weak}`,
      paddingBottom: theme.spacing(1),

      '&:hover, &:focus-within': {
        '& > div': {
          opacity: 1,
        },
      },

      '& > div': {
        marginBottom: 0,
        marginRight: theme.spacing(1),
      },
    }),
    wrapper: css({
      display: 'flex',
      flexDirection: 'column',
      flex: '1 1 0',
      width: '100%',
    }),
    icon: css({
      display: 'flex',
      alignItems: 'center',
      cursor: 'pointer',
      background: 'transparent',
      border: 'none',
      gap: theme.spacing(1),
    }),
  };
}

function changeLayoutTo(currentLayout: DashboardLayoutManager, newLayoutDescriptor: LayoutRegistryItem) {
  const layoutParent = currentLayout.parent;
  if (layoutParent && isLayoutParent(layoutParent)) {
    layoutParent.switchLayout(newLayoutDescriptor.createFromLayout(currentLayout));
  }
}
