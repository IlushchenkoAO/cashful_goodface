/* Peer Overview — sample data for each stage of a personal account (copy from the design prototype).
   Stages: new (no devices) → day1 (first devices) → active (2 months in) → payout (over the minimum). */
window.Cashful = window.Cashful || {};
Cashful.data = Cashful.data || {};

(function () {
  function device(name, os, icon, network, ip, status, note, traffic, earned) {
    return { name: name, os: os, icon: icon, network: network, ip: ip, status: status, note: note, traffic: traffic, earned: earned };
  }

  Cashful.data.peer = {
    new: {
      balance: '$0.00'
    },

    day1: {
      alert: { tone: 'success', title: 'Your devices are earning', text: 'Earnings update every hour. Devices on different networks earn separately.' },
      balance: '$0.09',
      balanceCaption: 'Payouts from $[X]',
      devicesStat: { value: '2 of 3', caption: '1 on a shared network' },
      periods: ['Today', '7 days'],
      period: 'Today',
      tableScope: 'today',
      summary: '3 devices · 2 earning',
      devices: [
        device('Pixel 8', 'Android 15', 'smartphone', 'Mobile data', '172.58.xx.xx', 'online', 'Earning now', '0.4 GB', '$0.05'),
        device('MacBook Pro', 'macOS 15', 'monitor', 'Home Wi-Fi', '93.184.xx.xx', 'online', 'Earning now', '0.3 GB', '$0.04'),
        device('iPhone 15', 'iOS 18', 'smartphone', 'Home Wi-Fi', '93.184.xx.xx', 'shared', 'MacBook Pro earns on this IP', '0.0 GB', '$0.00')
      ],
      tip: 'Tip: take iPhone 15 off home Wi-Fi to mobile data and it earns on its own network.'
    },

    active: {
      alert: { tone: 'warning', title: 'Office PC has been offline for 3 days', text: 'Check that the computer is on and Cashful is running. Offline devices don’t earn.' },
      balance: '$19.04',
      balanceCaption: 'Payouts from $[X]',
      devicesStat: { value: '3 of 5', caption: '1 offline, 1 on a shared network' },
      periods: ['Today', '7 days', '30 days'],
      period: '30 days',
      tableScope: 'this month',
      summary: '5 devices · 3 earning',
      devices: [
        device('Pixel 8', 'Android 15', 'smartphone', 'Mobile data', '172.58.xx.xx', 'online', 'Earning now', '15.2 GB', '$3.62'),
        device('iPhone 15', 'iOS 18', 'smartphone', 'Mobile data', '107.77.xx.xx', 'online', 'Earning now', '7.5 GB', '$1.79'),
        device('MacBook Pro', 'macOS 15', 'monitor', 'Home Wi-Fi', '93.184.xx.xx', 'online', 'Earning now', '16.8 GB', '$4.02'),
        device('Galaxy Tab S9', 'Android 14', 'smartphone', 'Home Wi-Fi', '93.184.xx.xx', 'shared', 'MacBook Pro earns on this IP', '0.0 GB', '$0.00'),
        device('Office PC', 'Windows 11', 'monitor', 'Office network', '81.23.xx.xx', 'offline', 'Last seen 3 days ago', '1.7 GB', '$0.43')
      ]
    },

    payout: {
      payoutBanner: true,
      balance: '$27.30',
      balanceCaption: 'Ready to withdraw',
      devicesStat: { value: '4 of 4', caption: 'All devices online' },
      periods: ['Today', '7 days', '30 days'],
      period: '30 days',
      tableScope: 'this month',
      summary: '4 devices · 4 earning',
      devices: [
        device('Pixel 8', 'Android 15', 'smartphone', 'Mobile data', '172.58.xx.xx', 'online', 'Earning now', '18.0 GB', '$4.21'),
        device('iPhone 15', 'iOS 18', 'smartphone', 'Mobile data', '107.77.xx.xx', 'online', 'Earning now', '10.1 GB', '$2.37'),
        device('MacBook Pro', 'macOS 15', 'monitor', 'Home Wi-Fi', '93.184.xx.xx', 'online', 'Earning now', '20.6 GB', '$4.86'),
        device('Office PC', 'Windows 11', 'monitor', 'Office network', '81.23.xx.xx', 'online', 'Earning now', '15.1 GB', '$3.48')
      ]
    }
  };

  Cashful.data.deviceStatus = {
    online: { tone: 'success', label: 'Online' },
    shared: { tone: 'warning', label: 'Same network' },
    offline: { tone: 'neutral', label: 'Offline' }
  };

  /* Install instructions — used by the Add device modal and the Download page.
     [X] values and commands are placeholders waiting on the client. */
  Cashful.data.platforms = {
    android: { title: 'Install Cashful on Android', kind: 'store', note: 'Android 8 or later · [X] MB', store: 'Get it on Google Play' },
    ios:     { title: 'Install Cashful on iPhone or iPad', kind: 'store', note: 'iOS 15 or later · [X] MB', store: 'Download on the App Store' },
    windows: { title: 'Install Cashful on Windows', kind: 'desktop', note: 'Version [X] · [X] MB · Windows 10 or later', store: 'Download .exe', where: 'It sits in the taskbar, next to the clock.' },
    macos:   { title: 'Install Cashful on macOS', kind: 'desktop', note: 'Version [X] · [X] MB · Apple silicon and Intel', store: 'Download .dmg', where: 'It sits in the menu bar, at the top of the screen.' },
    linux:   { title: 'Install Cashful on Linux', kind: 'command', soon: true, note: 'Ubuntu 20.04+, Debian 11+ · x86 and ARM', cmd: 'curl -fsSL https://get.cashful.com | sh' },
    docker:  { title: 'Run Cashful in Docker', kind: 'command', soon: true, note: 'Any host with Docker 20+', cmd: 'docker run -d --name cashful cashful/earn' },
    pi:      { title: 'Install Cashful on Raspberry Pi', kind: 'command', soon: true, note: 'Raspberry Pi 3 or later · Raspberry Pi OS', cmd: 'curl -fsSL https://get.cashful.com | sh' },
    router:  { title: 'Install Cashful on your router', kind: 'command', soon: true, note: 'OpenWrt on selected models · [X] MB free space', cmd: 'opkg install cashful-earn', hint: 'Connect to your router over SSH first, then run the command.' }
  };
})();
