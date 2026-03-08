# NixOS Channel Status Widget

A KDE Plasma 6 plasmoid that displays the current status of NixOS channels directly on your desktop or panel. Monitor channel updates, view commit hashes, and track all available NixOS channels with automatic refresh functionality.

[![Download on opendesktop.org](https://img.shields.io/badge/Download-opendesktop.org-blue)](https://www.opendesktop.org/p/2332279)

## Screenshot

![Preview](https://github.com/DocBrown101/org.kde.plasma.nixos.channelstatus/blob/main/docs/screenshot.png)

## Features

- **Real-time Channel Monitoring**: Display the last update time and current commit hash for your selected NixOS channel
- **All Channels Overview**: View status for all available NixOS channels in a scrollable list
- **Automatic Refresh**: Configurable update interval
- **Visual Status Indicators**: Color-coded status
- **Bilingual Support**: German and English interface
- **Network Resilience**: Automatic retry mechanism
- **Compact & Full Views**: Compact panel view and expanded popup with detailed information

## Installation

### Method 1: Download from opendesktop.org

1. Visit the [widget page](https://www.opendesktop.org/p/2332279)
2. Download the `.plasmoid` file
3. Install using one of these methods:
   - Right-click the file and select "Install Plasma Widget"
   - Or run: `plasmapkg2 -i org.kde.plasma.nixos.channelstatus.plasmoid`
4. Add the widget to your desktop or panel by right-clicking and selecting "Add Widgets..."

### Method 2: Build from Source

1. Clone this repository:
   ```bash
   git clone https://github.com/DocBrown101/org.kde.plasma.nixos.channelstatus.git
   cd org.kde.plasma.nixos.channelstatus
   ```

2. Create the plasmoid package:
   ```bash
   cd src
   zip -r ../org.kde.plasma.nixos.channelstatus.plasmoid *
   ```

3. Install the widget:
   ```bash
   plasmapkg2 -i ../org.kde.plasma.nixos.channelstatus.plasmoid
   ```

## Configuration

After adding the widget to your panel, configure it by right-clicking and selecting "Configure Widget":

- **Channel Version**: Select which NixOS channel to monitor (e.g., 25.11, 25.05, unstable)
- **Update Interval**: Set the refresh frequency in minutes (5-1440, default: 30)
- **Language**: Choose interface language (auto-detect, German, or English)

### Compact View

The compact panel view displays:
- Channel name (e.g., "NixOS 25.11")
- Time since last update (e.g., "vor 17 Stunden" or "17 hours ago")
- Status indicator (✓, ⚠️, ⏳, 🔄, ❓)

### Full Popup View

Expand the widget to see:
- Detailed status for your selected channel
- Complete list of all NixOS channels
- Clickable commit hashes linking to GitHub
- Refresh and "Nix Channel Status" web buttons
- Countdown to next automatic update

## Development & Testing

### Requirements

- KDE Plasma 6.0 or later
- Qt 6 or later
- Plasma SDK (for `plasmoidviewer`)

Install Plasma SDK:
```bash
# On NixOS
nix-shell -p kdePackages.plasma-sdk

# On other distributions
sudo apt install kdePackages.plasma-sdk  # Ubuntu/Debian
sudo dnf install kdePackages.plasma-sdk   # Fedora
```

### Testing the Widget

Test without installing to your system:

```bash
cd src
plasmoidviewer --applet .
```

Or test the installed widget:
```bash
plasmawindowed org.kde.plasma.nixos.channelstatus
```

### Build Package

Create the distributable `.plasmoid` file:
```bash
cd src
zip -r ../org.kde.plasma.nixos.channelstatus.plasmoid *
```

## API Data Source

This widget fetches data from the official NixOS Prometheus API:
- Channel update times: `https://prometheus.nixos.org/api/v1/query?query=channel_update_time`
- Channel revisions: `https://prometheus.nixos.org/api/v1/query?query=channel_revision`

Web interface reference: [https://status.nixos.org/](https://status.nixos.org/)

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

## License

This project is licensed under the [MIT License](LICENSE).

## Links

- **GitHub Repository**: https://github.com/DocBrown101/org.kde.plasma.nixos.channelstatus
- **Issue Tracker**: https://github.com/DocBrown101/org.kde.plasma.nixos.channelstatus/issues
- **Download Page**: https://www.opendesktop.org/p/2332279
