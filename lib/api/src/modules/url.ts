import { navigate as navigateRouter, NavigateOptions } from '@reach/router';
import { queryFromLocation } from '@storybook/router';
import { toId } from '@storybook/csf';

import { NAVIGATE_URL } from '@storybook/core-events';
import { ModuleArgs, ModuleFn } from '../index';
import { PanelPositions } from './layout';

interface Additions {
  isFullscreen?: boolean;
  showPanel?: boolean;
  panelPosition?: PanelPositions;
  showNav?: boolean;
  selectedPanel?: string;
  viewMode?: string;
}

export interface SubState {
  customQueryParams: QueryParams;
}

// Initialize the state based on the URL.
// NOTE:
//   Although we don't change the URL when you change the state, we do support setting initial state
//   via the following URL parameters:
//     - full: 0/1 -- show fullscreen
//     - panel: bottom/right/0 -- set addons panel position (or hide)
//     - nav: 0/1 -- show or hide the story list
//
//   We also support legacy URLs from storybook <5
const initialUrlSupport = ({
  navigate,
  state: { location, path, viewMode, storyId },
}: ModuleArgs) => {
  const addition: Additions = {};
  const query = queryFromLocation(location);
  let selectedPanel;

  const {
    full,
    panel,
    nav,
    addons,
    panelRight,
    stories,
    addonPanel,
    selectedKind,
    selectedStory,
    path: queryPath,
    ...customQueryParams
  } = query;

  if (full === '1') {
    addition.isFullscreen = true;
  }
  if (panel) {
    if (['right', 'bottom'].includes(panel)) {
      addition.panelPosition = panel;
    } else if (panel === '0') {
      addition.showPanel = false;
    }
  }
  if (nav === '0') {
    addition.showNav = false;
  }

  // Legacy URLs
  if (addons === '0') {
    addition.showPanel = false;
  }
  if (panelRight === '1') {
    addition.panelPosition = 'right';
  }
  if (stories === '0') {
    addition.showNav = false;
  }

  if (addonPanel) {
    selectedPanel = addonPanel;
  }

  if (selectedKind && selectedStory) {
    const id = toId(selectedKind, selectedStory);
    setTimeout(() => navigate(`/${viewMode}/${id}`, { replace: true }), 1);
  } else if (selectedKind) {
    // Create a "storyId" of the form `kind-sanitized--*`
    const standInId = toId(selectedKind, 'star').replace(/star$/, '*');
    setTimeout(() => navigate(`/${viewMode}/${standInId}`, { replace: true }), 1);
  } else if (!queryPath || queryPath === '/') {
    setTimeout(() => navigate(`/${viewMode}/*`, { replace: true }), 1);
  } else if (Object.keys(query).length > 1) {
    // remove other queries
    setTimeout(() => navigate(`${queryPath}`, { replace: true }), 1);
  }

  return { viewMode, layout: addition, selectedPanel, location, path, customQueryParams, storyId };
};

export interface QueryParams {
  [key: string]: string | null;
}

export interface SubAPI {
  navigateUrl: (url: string, options: NavigateOptions<{}>) => void;
  getQueryParam: (key: string) => string | undefined;
  getUrlState: () => {
    queryParams: QueryParams;
    path: string;
    viewMode?: string;
    storyId?: string;
    url: string;
  };
  setQueryParams: (input: QueryParams) => void;
}

export const init: ModuleFn = ({ store, navigate, state, provider, fullAPI, ...rest }) => {
  const api: SubAPI = {
    getQueryParam: key => {
      const { customQueryParams } = store.getState();
      if (customQueryParams) {
        return customQueryParams[key];
      }
      return undefined;
    },
    getUrlState: () => {
      const { path, viewMode, storyId, url, customQueryParams } = store.getState();
      const queryParams = customQueryParams;

      return {
        queryParams,
        path,
        viewMode,
        storyId,
        url,
      };
    },
    setQueryParams(input) {
      const { customQueryParams } = store.getState();
      const queryParams: QueryParams = {};
      store.setState({
        customQueryParams: {
          ...customQueryParams,
          ...Object.entries(input).reduce((acc, [key, value]) => {
            if (value !== null) {
              acc[key] = value;
            }
            return acc;
          }, queryParams),
        },
      });
    },
    navigateUrl(url: string, options: NavigateOptions<{}>) {
      navigateRouter(url, options);
    },
  };

  const initModule = () => {
    fullAPI.on(NAVIGATE_URL, (url: string, options: { [k: string]: any }) => {
      fullAPI.navigateUrl(url, options);
    });
  };

  return {
    api,
    state: initialUrlSupport({ store, navigate, state, provider, fullAPI, ...rest }),
    init: initModule,
  };
};
