/* Developer SDK — placeholder business values, versions, requirements and texts. The client edits this file only.
   All of it is a placeholder; the snippets are illustrative pseudo-code, not a real API.
   Only the download buttons are locked until KYC is approved (the page itself is open to everyone).
   `{APP_UUID}` in a snippet is replaced by the selected app's id, or by `appIdPlaceholder` when there is no app. */
window.Cashful = window.Cashful || {};
Cashful.sdkConfig = {
  defaultPlatform: 'android',
  consentTemplateRequiresKyc: false,
  supportEmail: 'support@cashful.example',
  appIdPlaceholder: 'YOUR_APP_UUID',

  platforms: [
    { id: 'android',      name: 'Android',      icon: 'smartphone', status: 'available', version: '1.0.0', releasedAt: '2026-09-01', requirements: 'Android 7.0+ (API 24)', docsUrl: '#' },
    { id: 'ios',          name: 'iOS',          icon: 'smartphone', status: 'available', version: '1.0.0', releasedAt: '2026-09-01', requirements: 'iOS 14+', docsUrl: '#' },
    { id: 'windows',      name: 'Windows',      icon: 'monitor',    status: 'available', version: '1.0.0', releasedAt: '2026-09-01', requirements: 'Windows 10+', docsUrl: '#' },
    { id: 'macos',        name: 'macOS',        icon: 'monitor',    status: 'available', version: '1.0.0', releasedAt: '2026-09-01', requirements: 'macOS 12+', docsUrl: '#' },
    { id: 'linux',        name: 'Linux',        icon: 'code',       status: 'coming_soon' },
    { id: 'unity',        name: 'Unity',        icon: 'package',    status: 'coming_soon' },
    { id: 'flutter',      name: 'Flutter',      icon: 'package',    status: 'coming_soon' },
    { id: 'react-native', name: 'React Native', icon: 'package',    status: 'coming_soon' },
    { id: 'smart-tv',     name: 'Smart TV',     icon: 'monitor',    status: 'coming_soon' }
  ],

  steps: [
    { id: 'add', title: 'Add the SDK to your project', description: 'Download the package for your platform and add it to your project. It adds a small background service and nothing else.' },
    { id: 'init', title: 'Initialize with your App ID', description: 'Start the SDK when your app launches. Use the App ID of the app you created in Cashful.' },
    { id: 'consent', title: 'Show the consent screen', description: 'Ask people for their explicit opt-in before the SDK starts. Start it only when they allow it.' },
    { id: 'test', title: 'Test and submit for review', description: 'Run your app on a device and check that it connects. Then send the app for review. Once it is Active, its data shows up in Analytics.' }
  ],

  snippets: {
    android: {
      add: '// build.gradle (placeholder)\ndependencies {\n    implementation(files("libs/cashful-sdk-android.aar"))\n}',
      init: '// App.kt\nclass App : Application() {\n    override fun onCreate() {\n        super.onCreate()\n        Cashful.init(this, appId = "{APP_UUID}")\n    }\n}',
      consent: '// Ask first, start only after opt-in\nCashful.showConsent(activity) { accepted ->\n    if (accepted) Cashful.start()\n}'
    },
    ios: {
      add: '// Package.swift (placeholder)\n.binaryTarget(\n    name: "CashfulSDK",\n    path: "CashfulSDK.xcframework"\n)',
      init: '// AppDelegate.swift\nfunc application(_ app: UIApplication, didFinishLaunchingWithOptions options: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {\n    Cashful.configure(appId: "{APP_UUID}")\n    return true\n}',
      consent: '// Ask first, start only after opt-in\nCashful.presentConsent(from: self) { accepted in\n    if accepted { Cashful.start() }\n}'
    },
    windows: {
      add: '// NuGet (placeholder)\ndotnet add package Cashful.Sdk --source ./cashful-sdk-windows',
      init: '// Program.cs\nCashfulSdk.Initialize("{APP_UUID}");',
      consent: '// Ask first, start only after opt-in\nvar accepted = await CashfulSdk.ShowConsentAsync();\nif (accepted) CashfulSdk.Start();'
    },
    macos: {
      add: '// Package.swift (placeholder)\n.binaryTarget(\n    name: "CashfulSDK",\n    path: "CashfulSDK.xcframework"\n)',
      init: '// AppDelegate.swift\nfunc applicationDidFinishLaunching(_ notification: Notification) {\n    Cashful.configure(appId: "{APP_UUID}")\n}',
      consent: '// Ask first, start only after opt-in\nCashful.presentConsent(in: window) { accepted in\n    if accepted { Cashful.start() }\n}'
    }
  },

  consent: {
    requirements: [
      'Ask for explicit opt-in before the SDK starts.',
      'Let users switch it off at any time.',
      'Describe in plain language what happens when they opt in.'
    ],
    templateFileName: 'cashful-consent-template'
  },

  texts: {
    subtitle: 'Add Cashful to your app. It shares a little unused bandwidth from people who opt in, and you earn from it.',
    snippetNote: 'Example code, final API is provided with the SDK.',
    lockedHint: 'Available after KYC approval',
    lockedLink: 'Go to Settings',
    noAppsText: 'Create an app to get your App ID',
    noAppsLink: 'Create an app',
    appNotActiveNote: 'You can integrate now. Analytics appear once the app is Active.',
    consentPreviewNote: 'Example',
    consentTitle: 'Share your unused internet?',
    consentText: 'Let this app share a small part of your unused internet connection. You get free access to the app, and nothing on your device is read or changed.',
    consentAllow: 'Allow',
    consentDeny: 'No thanks',
    consentOff: 'You can switch this off any time in Settings.'
  }
};
