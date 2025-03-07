import { css } from '@emotion/css';
import { debounce } from 'lodash';
import React, { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom-v5-compat';

import { GrafanaTheme2, NavModel, NavModelItem, SelectableValue } from '@grafana/data';
import {
  EmptyState,
  InteractiveTable,
  Column,
  Select,
  Icon,
  Stack,
  useStyles2,
  FilterInput,
  TagList,
  Link,
  Button,
} from '@grafana/ui';
import { clearLinkButtonStyles } from '@grafana/ui/src/components/Button';
import { getAPINamespace } from 'app/api/utils';
import { Page } from 'app/core/components/Page/Page';
import { TagFilter, TermCount } from 'app/core/components/TagFilter/TagFilter';
import { useNavModel } from 'app/core/hooks/useNavModel';
import { t } from 'app/core/internationalization';
import kbn from 'app/core/utils/kbn';

import { getColumnStyles } from '../search/page/components/SearchResultsTable';
import { GrafanaSearcher, SearchQuery } from '../search/service/types';
import { SearchHit, UnifiedSearcher } from '../search/service/unified';

interface Resource extends SearchHit {
  isExpanded?: boolean;
  owner?: string;
  level?: number;
  parentId?: number;
  hasSubfolders?: boolean;
}

type ResourceType = 'dashboard' | 'folder' | 'alert' | 'playlist' | 'slo';

const typeOptions: Array<SelectableValue<ResourceType>> = [
  { label: 'All', value: undefined },
  { label: 'Dashboard', value: 'dashboard' },
  { label: 'Folder', value: 'folder' },
  { label: 'Alert', value: 'alert' },
  { label: 'Playlist', value: 'playlist' },
  { label: 'SLO', value: 'slo' },
];

const searchURI = `/apis/search.grafana.app/v0alpha1/namespaces/${getAPINamespace()}/search`;

const searcher = new UnifiedSearcher({} as GrafanaSearcher, searchURI);

const FoldersPage: React.FC = () => {
  const [resources, setResources] = useState<Resource[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTypes, setSelectedTypes] = useState<Array<SelectableValue<ResourceType>>>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [availableTags, setAvailableTags] = useState<TermCount[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<string>('');
  const [showTable, setShowTable] = useState(true);

  const styles = useStyles2(getStyles);
  const clearButtonStyle = useStyles2(clearLinkButtonStyles);

  const defaultNavModel = useNavModel('finder');
  const location = useLocation();
  const [navModel, setNavModel] = useState(defaultNavModel);

  const columnStyles = useStyles2(getColumnStyles);

  // Create a debounced function to update searchTerm
  const debouncedSearch = useMemo(
    () =>
      debounce((query: string) => {
        setSearchTerm(query);
      }, 300),
    []
  );

  // Handle search input changes
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    debouncedSearch(value);
  };

  useEffect(() => {
      buildNavModel(defaultNavModel, location.pathname, searcher).then((updatedNavModel) => {
      setNavModel(updatedNavModel as NavModel);
    });
  }, [location.pathname, defaultNavModel]);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      const kinds = selectedTypes.map((t) => t.value!.toString());
      const sort = sortBy !== '' ? sortBy : undefined;
      let query: SearchQuery = { 
        kind: kinds, 
        tags: selectedTags, 
        query: searchTerm,
        sort: sort
      }
      if (!location.pathname.endsWith('finder')) {
        const parts = location.pathname.split('/');
        const folderId = parts[parts.length - 1];
        query = {...query, location: folderId}
      }
      try {
        const results = await Promise.all([
          searcher.fetchResults(query),
          searcher.tags({ kind: kinds })
        ]);
        setResources(results[0].hits);
        setAvailableTags(results[1]);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setIsLoading(false);
      }
    };
    void loadData();
  }, [selectedTypes, selectedTags, searchTerm, location.pathname, sortBy]);

  const getIconForResource = (resource: string) => {
    switch (resource) {
      case 'playlists':
        return 'play';
      case 'dashboards':
        return 'apps';
      case 'folders':
          return 'folder';
      case 'alerts':
        return 'bell';
      case 'slos':
        return 'chart-line';
      default:
        return 'folder';
    }
  };

  // TODO: Implement folder expand/collapse
  // const handleExpand = (folder: Folder) => {
  //   setFolders((prevFolders) =>
  //     prevFolders.map((f) => (f.name === folder.name ? { ...f, isExpanded: !f.isExpanded } : f))
  //   );
  // };

  function toURL(resource: string, name: string, title: string): string {
    if (resource.startsWith('folder')) {
      return `/finder/${name}`;
    }
    if (resource.startsWith('playlist')) {
      return `/playlists/play/${name}`;
    }
    if (resource.startsWith('alert')) {
      return `/alerting/grafana/${name}/view`;
    }
    if (resource.startsWith('slo')) {
      return `/d/grafana_slo_app-${name}`;
    }
    const slug = kbn.slugifyForUrl(title);
    return `/d/${name}/${slug}`;
  }

  const onResourceLinkClicked = () => {}

  // This is a hack to force the table to re-render when the sort order changes
  const handleSortChange = () => {
    setShowTable(!showTable);
    setSortBy((sortBy === '' || sortBy === '-name') ? 'name' : '-name');
    setTimeout(() => {
      setShowTable(true);
    }, 0);
  };

  const renderTable = (resources: SearchHit[]) => {
    const rootResources = resources.filter(resource => resource.location === "general" || resource.location === "");
    
    // Recursive function to get all children
    const getAllChildren = (parent: Resource, allResources: Resource[]): Resource[] => {
      const result: Resource[] = [];
      const children = allResources.filter(r => r.location === parent.title);
      
      children.forEach(child => {
        result.push(child);
        if (child.isExpanded && child.resource === 'folders') {
          result.push(...getAllChildren(child, allResources));
        }
      });
      
      return result;
    };

    const tableData = rootResources.reduce((acc: Resource[], resource: Resource) => {
      acc.push(resource);
      // If this is an expanded folder, add all its children recursively
      if (resource.isExpanded) {
        acc.push(...getAllChildren(resource, resources));
      }
      return acc;
    }, []);

    const hasChildren = (folder: Resource) => {
      return resources.some(r => r.location === folder.title);
    };

    const getIndentation = (resource: Resource): number => {
      if (!resource?.location || resource.location === 'general' || resource.location === '') {
        return 0;
      }
      let level = 1;
      let currentLocation = resource.location;
      let maxDepth = 5 // same hardcoded value as in the BE
      
      while (currentLocation && maxDepth > 0) {
        const parent = resources.find(r => r.title === currentLocation);
        if (!parent?.location || parent.location === 'general' || parent.location === '') {
          break;
        }
        level++;
        currentLocation = parent.location;
        maxDepth--;
      }
      return level * 20;
    };

    const columns: Array<Column<Resource>> = [
          {
            id: 'nameWithExpand',
            header: 'Name',
            cell: ({ row: { original } }) => {
              const indentation = getIndentation(original);
              const showChevron = original.resource === 'folders' && hasChildren(original);

              return (
                <div className={styles.nameCell} style={{ paddingLeft: indentation }}>
                  <div className={styles.chevronWrapper}>
                    {showChevron ? (
                      <button onClick={() => handleExpand(original)} className={styles.expandButton}>
                        <Icon name={original.isExpanded ? 'angle-down' : 'angle-right'} />
                      </button>
                    ) : (
                      <div className={styles.expandButton} /> // Placeholder for consistent spacing
                    )}
                  </div>
                  <Link
                    aria-label={`open-${original.title}`}
                    href={toURL(original.resource, original.name, original.title)}
                    className="external-link"
                    onClick={onResourceLinkClicked}
                  >
                    {original.title}
                  </Link>
                </div>
              );
            },
          },
          {
            id: 'type',
            header: 'Type',
            cell: ({ row: { original } }) => {
              const iconName = getIconForResource(original.resource);
              const displayType = original.resource.slice(0, -1); // Remove last character ('s')

              return (
                <div className="flex items-center">
                  <Button
                    variant="secondary"
                    aria-label={`open-${original.location}`}
                    className={clearButtonStyle}
                    onClick={() => setSelectedTypes([{label: displayType, value: original.resource as ResourceType}])}
                  >
                  {iconName && <Icon name={iconName} style={{ marginRight: '6px' }}/>}
                  <span className={styles.resourceType}>{displayType}</span>
                  </Button>
                </div>
              );
            },
          },
          {
            id: 'location',
            header: 'Location',
            cell: ({ row: { original } }) => {
              return (
                <div className="flex items-center">
                  <Icon name={'folder'} style={{ marginRight: '6px' }}/>
                  <Link
                    aria-label={`open-${original.location}`}
                    href={toURL('folder', original.folder, original.location)}
                    onClick={onResourceLinkClicked}
                  >
                  <span>{original.location}</span>
                  </Link>
                </div>
              );
            },
          },
          {
            id: 'tags',
            header: 'Tags',
            cell: ({ row: { original } }) => (
              <div key={original.name} {...original} className={columnStyles.cell}>
                  {original.tags ? <TagList className={columnStyles.tagList} tags={original.tags}
                    onClick={
                      (tag) => setSelectedTags([...selectedTags, tag])
                    } /> : '-'
                  }
              </div>
            )
          },
        ];
        // TODO if we want to drill down into the folders

          // {
          //   id: 'name',
          //   header: 'Name',
          //   cell: ({ row: { original } }) => (
          //     <div style={{ marginLeft: original.level ? original.level * 20 : 0 }}>
          //       {original.hasSubfolders && (
          //         <Icon
          //           name={original.isExpanded ? 'angle-down' : 'angle-right'}
          //           onClick={() => handleExpand(original)}
          //           className={styles.expandIcon}
          //         />
          //       )}
          //       {original.title}
          //     </div>
          //   ),
          // }

    return (
        <InteractiveTable
          data={resources}
          columns={columns}
          getRowId={(row) => row.name}
        />
    );
  };

  return (
    <Page
      navId="finder"
      navModel={navModel}
    >
      <Page.Contents>
        <div className={styles.filtersRow}>
          <Stack direction="row" gap={2}>
            <FilterInput
                value={searchQuery}
                onChange={handleSearchChange}
                placeholder="Search resources"
              />
          </Stack>
          <Stack direction="row" gap={2}>
            <Select
              value={selectedTypes}
              onChange={(v) => setSelectedTypes(v as Array<SelectableValue<ResourceType>>)}
              options={typeOptions}
              placeholder="Filter by Type"
              width={20}
              isMulti={true}
            />
            <TagFilter
              isClearable
              tags={selectedTags}
              tagOptions={() => Promise.resolve(availableTags)}
              onChange={setSelectedTags}
              placeholder={t('playlist-edit.form.add-tag-placeholder', 'Filter by Tags')}
              width={20}
            />
          </Stack>
        </div>

        {error && (
          <EmptyState message={error} variant={'call-to-action'} />
        )}

        {!isLoading && !error && renderTable(resources)}
      </Page.Contents>
    </Page>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  filtersRow: css({
    display: 'flex',
    flexDirection: 'column',
    gap: `6px`
  }),
  resourceType: css({
    textTransform: 'capitalize',
  }),
  nameCell: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
  }),
  chevronWrapper: css({
    display: 'flex',
    alignItems: 'center',
    width: '24px',
  }),
  expandButton: css({
    background: 'none',
    border: 'none',
    padding: 0,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '24px',
    height: '24px',
    '&:hover': {
      color: theme.colors.text.primary,
    },
  }),
});

export default FoldersPage;

async function buildNavModel(navModel: NavModel, path: string, searcher: UnifiedSearcher) {
  if (!path.endsWith('finder')) {
    const parts = location.pathname.split('/');
    const folderId = parts[parts.length - 1];
    const path = await fetchPath(folderId, searcher);
    if (path.length === 0) {
      return navModel;
    }

    let parentNodes = []
    let node = navModel.node
    while (true) {
      if (isPageNode(node)) {
        parentNodes.unshift(node)
      }
      if (node.parentItem) {
        node = node.parentItem
      } else {
        break
      }
    }
    
    const children = [
      ...path.map((folder, index) => ({
        text: folder.title,
        url: `/finder/${folder.name}`,
        icon: 'folder',
        active: index === path.length - 1,
        parentItem: index === 0 ? null : {
          text: path[index - 1].title,
          url: `/finder/${path[index - 1].name}`,
          icon: 'folder',
        },
      })),
    ];

    // make sure every parent up the tree is set
    const nodes = [...parentNodes, ...children]
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      if (nodes[i - 1]) {
        node.parentItem = nodes[i - 1]
        if (node.parentItem.url !==  '/' && node.url !== '/finder') {
          setParentItem(node as NavModelItem, nodes[i - 1] as NavModelItem)
        }
      }
    }
  
    const navModelWithChildren = {
      ...navModel,
      main: {
        ...navModel.main,
        active: false,
        children: nodes,
      },
      node: nodes[nodes.length - 1],
    };
    return navModelWithChildren;
  }
  return navModel;
}

const fetchPath = async (folderId: string, searcher: UnifiedSearcher) => {
  const path: SearchHit[] = [];
  const folder = await fetchFolder(folderId, searcher);
  path.push(folder);
  if (folder.folder !== undefined && folder.folder !== null && folder.folder.length > 0 && folder.folder !== 'general') {
    const parentFolder = await fetchFolder(folder.folder, searcher);
    path.unshift(parentFolder)
  }
  return path;
};

const fetchFolder = async (folderId: string, searcher: UnifiedSearcher) => {
  const resp = await searcher.fetchResults({ kind: ['folder'], uid: [folderId] });
  return resp.hits[0];
};

function isPageNode(node: NavModelItem) {
  return node.url === '/finder' || node.url === '/';
}

const setParentItem = (node: NavModelItem, parent: NavModelItem) => {
  if (node === null || parent === null) {
    return;
  }
  node.parentItem = parent
  if (parent.parentItem && parent.parentItem.url !== '/' && parent.parentItem.url !== '/finder') {
    setParentItem(parent, parent.parentItem)
  }
}
