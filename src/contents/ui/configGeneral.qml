import QtQuick
import QtQuick.Layouts
import QtQuick.Controls as QQC2
import org.kde.kirigami as Kirigami

ColumnLayout {
    id: root
    
    property alias cfg_channelVersion: channelVersionField.text
    property alias cfg_updateInterval: updateIntervalSpinBox.value
    property alias cfg_notifyOnChannelUpdate: notifyOnChannelUpdateCheckBox.checked
    property alias cfg_warningThresholdHours: warningThresholdSpinBox.value
    property string cfg_language
    
    Kirigami.FormLayout {
        
        QQC2.ComboBox {
            id: languageComboBox
            Kirigami.FormData.label: "Sprache / Language:"
            
            model: [
                { text: "Automatisch / Automatic", value: "auto" },
                { text: "Deutsch", value: "de" },
                { text: "English", value: "en" }
            ]
            
            textRole: "text"
            valueRole: "value"
            
            currentIndex: {
                var lang = cfg_language || "auto";
                for (var i = 0; i < model.length; i++) {
                    if (model[i].value === lang) return i;
                }
                return 0;
            }
            
            onActivated: {
                cfg_language = model[currentIndex].value;
            }
            
            Component.onCompleted: {
                cfg_language = cfg_language || "auto";
            }
            
            QQC2.ToolTip.visible: hovered
            QQC2.ToolTip.text: "Wähle die Anzeigesprache für das Plasmoid\nSelect the display language for the plasmoid"
        }
        
        Item {
            Kirigami.FormData.isSection: true
            height: Kirigami.Units.largeSpacing
        }
        
        QQC2.TextField {
            id: channelVersionField
            Kirigami.FormData.label: "Channel:"
            placeholderText: "26.05"
            
            QQC2.ToolTip.visible: hovered
            QQC2.ToolTip.text: "Channel-Kurzform oder exakter Channel-Name (z.B. 26.05, nixos-26.05-small, nixpkgs-26.05-darwin)\nChannel shorthand or exact channel name (e.g. 26.05, nixos-26.05-small, nixpkgs-26.05-darwin)"
        }
        
        QQC2.Label {
            text: "Beispiele / Examples: 26.05, unstable, nixos-26.05-small, nixpkgs-26.05-darwin"
            font.pointSize: Kirigami.Theme.smallFont.pointSize
            color: Kirigami.Theme.disabledTextColor
            wrapMode: Text.WordWrap
            Layout.fillWidth: true
        }
        
        Item {
            Kirigami.FormData.isSection: true
            height: Kirigami.Units.largeSpacing
        }
        
        QQC2.SpinBox {
            id: updateIntervalSpinBox
            Kirigami.FormData.label: "Aktualisierungs-Intervall / Update Interval (min):"
            from: 5
            to: 1440
            stepSize: 5
            
            QQC2.ToolTip.visible: hovered
            QQC2.ToolTip.text: "Wie oft soll der Status automatisch aktualisiert werden? (5-1440 Minuten)\nHow often should the status be automatically updated? (5-1440 minutes)"
        }

        QQC2.SpinBox {
            id: warningThresholdSpinBox
            Kirigami.FormData.label: "Warnschwelle / Warning threshold (h):"
            from: 1
            to: 720
            stepSize: 1

            QQC2.ToolTip.visible: hovered
            QQC2.ToolTip.text: "Ab wie vielen Stunden ohne Channel-Update soll der Status orange werden?\nAfter how many hours without a channel update should the status turn orange?"
        }

        QQC2.CheckBox {
            id: notifyOnChannelUpdateCheckBox
            Kirigami.FormData.label: "Benachrichtigung / Notification:"
            text: "Bei Channel-Update benachrichtigen / Notify on channel update"

            QQC2.ToolTip.visible: hovered
            QQC2.ToolTip.text: "Zeigt eine Plasma-Benachrichtigung, wenn sich der Commit des ausgewählten Channels ändert.\nShows a Plasma notification when the selected channel commit changes."
        }
        
        Item {
            Kirigami.FormData.isSection: true
            height: Kirigami.Units.largeSpacing
        }
        
        QQC2.Label {
            Kirigami.FormData.isSection: true
            text: "Hinweise / Notes:"
            font.bold: true
        }
        
        QQC2.Label {
            text: "• Kurzformen werden als NixOS-Channels interpretiert; exakte Channel-Namen können direkt verwendet werden\n  Shorthands are interpreted as NixOS channels; exact channel names can be used directly"
            wrapMode: Text.WordWrap
            Layout.fillWidth: true
            font.pointSize: Kirigami.Theme.smallFont.pointSize
        }
    }
}
