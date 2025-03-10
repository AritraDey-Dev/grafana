import { createEventFactory, TrackingEventProps } from 'app/core/services/echo/Echo';

//Currently just 'timeRange' is supported
//in short term, we could add 'templateVariables' for example
type SubEntryTypes = 'timeRange';

//
type UnifiedHistoryDrawerActions = 'open' | 'close';

interface UnifiedHistoryEntryClicked extends TrackingEventProps {
  /** We will also work with the current URL but we will get this from Rudderstack data
   *  URL to return to
   */
  entryURL: string;
  /** In the case we want to go back to a specific query param, currently just a specific time range */
  subEntry?: SubEntryTypes;
}

interface UnifiedHistoryEntryDuplicated extends TrackingEventProps {
  /** Common name of the history entries */
  entryName: string;
  /** URL of the last entry */
  lastEntryURL: string;
  /** URL of the new entry */
  newEntryURL: string;
}

interface UnifiedHistoryDrawerInteraction extends TrackingEventProps {
  /** Whether the user opens or closes the HistoryDrawer */
  type: UnifiedHistoryDrawerActions;
}

const createUnifiedHistoryEvent = createEventFactory('grafana', 'unified_history');

/**
 * Event triggered when a user clicks on an entry of the `HistoryDrawer`
 * @owner grafana-frontend-platform
 */
export const logClickUnifiedHistoryEntryEvent = createUnifiedHistoryEvent<UnifiedHistoryEntryClicked>('entry_clicked');

/**
 * Event triggered when history entry name matches the previous one
 * so we keep track of duplicated entries and be able to analyze them
 * @owner grafana-frontend-platform
 */
export const logDuplicateUnifiedHistoryEntryEvent =
  createUnifiedHistoryEvent<UnifiedHistoryEntryDuplicated>('duplicated_entry_rendered');

/** We keep track of users open and closing the drawer
 * @owner grafana-frontend-platform
 */
export const logUnifiedHistoryDrawerInteractionEvent =
  createUnifiedHistoryEvent<UnifiedHistoryDrawerInteraction>('drawer_interaction');

/**We keep track of users clicking on the `Show more` button
 * @owner grafana-frontend-platform
 */
export const logUnifiedHistoryShowMoreEvent = createUnifiedHistoryEvent('show_more');
