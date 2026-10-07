/* Developer Analytics — placeholder business values and texts. The client edits this file only.
   Analytics is never gated by KYC; empty states depend on the app statuses and on the data.
   App statuses used everywhere: Draft, In review, Changes requested, Active. */
window.Cashful = window.Cashful || {};
Cashful.analyticsConfig = {
  defaultPeriod: '30d',            // 7d | 30d | 90d | custom
  maxCustomRangeDays: 365,
  tablePageSize: 15,
  exportCsvEnabled: true,
  liveLabelEnabled: true,
  metricDefinitions: {             // placeholders: the client's backend defines the final meaning
    nodesOnline: 'Unique nodes that were online on that day.',
    connectedIps: 'Unique IP addresses connected on that day.',
    earnings: 'Amount accrued for the period. Your payable balance in Payouts can differ because part of it may already be paid or in processing.'
  },
  statusHints: {
    notActive: 'Analytics available once the app is Active'
  },
  // What the person can do next for an app that is not Active yet
  statusActions: {
    draft: 'Submit for review',
    in_review: 'Waiting for review',           // a link to the app, no action
    changes_requested: 'View feedback'
  },
  texts: {
    noAppsTitle: 'Analytics will appear once an app is Active',
    noAppsText: 'Create an app and send it for review. Once it is Active, its nodes, connected IPs and earnings show up here.',
    noAppsAction: 'Create your first app',
    noneActiveTitle: 'Analytics will appear once an app is Active',
    noneActiveText: 'Your apps are not live yet. Here is where each one stands.',
    appNotActiveText: 'Analytics available once the app is Active.',
    noNodesTitle: 'No nodes yet',
    noNodesText: 'Data appears after your first users opt in.',
    noNodesAction: 'Read the SDK installation guide',
    noPeriodTitle: 'No data for this period',
    noPeriodText: 'Nothing was recorded for these apps in the selected dates. Try another period.',
    noPeriodAction: 'Reset period',
    errorTitle: 'We couldn’t load analytics',
    errorText: 'Something went wrong on our side. Your data is safe.',
    errorAction: 'Retry'
  }
};
