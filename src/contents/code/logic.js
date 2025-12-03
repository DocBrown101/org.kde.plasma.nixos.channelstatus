var channelStatus = { 
    lastUpdated: "Warte auf Verbindung...", 
    revision: "", 
    status: "waiting", 
    channel: ""
};
var retryCount = 0;
var maxRetries = 5;
var retryDelay = 5000;
var translateFunc = null; // Wird von QML gesetzt

function fetchAPI(url, callback) {
    var xhr = new XMLHttpRequest();
    var hasResponded = false;
    
    var timeoutTimer = Qt.createQmlObject('import QtQuick; Timer { interval: 10000; repeat: false; running: true }', Qt.application, 'timeoutTimer');
    
    timeoutTimer.triggered.connect(function() {
        if (!hasResponded) {
            hasResponded = true;
            xhr.abort();
            callback({ status: "network_error", error: "Timeout" });
        }
        timeoutTimer.destroy();
    });
    
    xhr.onreadystatechange = function() {
        if (xhr.readyState === XMLHttpRequest.DONE && !hasResponded) {
            hasResponded = true;
            timeoutTimer.stop();
            timeoutTimer.destroy();
            
            if (xhr.status === 200) {
                try {
                    callback({ status: "success", data: JSON.parse(xhr.responseText) });
                } catch (e) {
                    callback({ status: "error", error: "Parse Error: " + e });
                }
            } else if (xhr.status === 0) {
                callback({ status: "network_error", error: tr("Keine Verbindung", "No connection") });
            } else {
                callback({ status: "error", error: "HTTP " + xhr.status });
            }
        }
    };
    
    try {
        xhr.open("GET", url);
        xhr.send();
    } catch (e) {
        hasResponded = true;
        timeoutTimer.stop();
        timeoutTimer.destroy();
        callback({ status: "network_error", error: e.toString() });
    }
}

function fetchChannelStatus(version, callback, isRetry) {
    if (!isRetry) {
        retryCount = 0;
        console.log("=== Lade Channel-Daten ===");
    }
    
    var channelName = "nixos-" + version;
    
    fetchAPI("https://prometheus.nixos.org/api/v1/query?query=channel_update_time", function(result) {
        if (result.status === "success") {
            retryCount = 0;
            var channelData = findChannelInResponse(result.data, channelName);
            
            if (channelData) {
                fetchAPI("https://prometheus.nixos.org/api/v1/query?query=channel_revision", function(revResult) {
                    var revision = revResult.status === "success" ? 
                        findRevisionForChannel(revResult.data, channelName) : 
                        { commit: "", fullCommit: "" };
                    
                    var status = {
                        lastUpdated: formatDateTime(channelData.date),
                        rawDateTime: channelData.date.toISOString(),
                        timestamp: channelData.timestamp,
                        commit: revision.commit,
                        fullCommit: revision.fullCommit,
                        status: "success",
                        channel: channelName
                    };
                    
                    channelStatus = status;
                    callback(status);
                });
            } else {
                var notFoundStatus = {
                    lastUpdated: tr("Channel nicht gefunden", "Channel not found"),
                    status: "not_found",
                    channel: channelName
                };
                channelStatus = notFoundStatus;
                callback(notFoundStatus);
            }
        } else if (result.status === "network_error" && retryCount < maxRetries) {
            retryCount++;
            console.log("⏳ Retry", retryCount, "/", maxRetries);
            
            var retryStatus = {
                lastUpdated: tr("Verbindungsfehler, Retry %1/%2...", "Connection error, retry %1/%2...", retryCount, maxRetries),
                status: "retrying",
                channel: channelName,
                retryCount: retryCount,
                maxRetries: maxRetries
            };
            
            channelStatus = retryStatus;
            callback(retryStatus);
            
            var retryTimer = Qt.createQmlObject('import QtQuick; Timer { interval: ' + retryDelay + '; repeat: false; running: true }', Qt.application, 'retryTimer');
            retryTimer.triggered.connect(function() {
                fetchChannelStatus(version, callback, true);
                retryTimer.destroy();
            });
        } else {
            var errorStatus = {
                lastUpdated: retryCount >= maxRetries ? tr("Keine Verbindung", "No connection") : result.error,
                status: "error",
                channel: channelName
            };
            retryCount = 0;
            channelStatus = errorStatus;
            callback(errorStatus);
        }
    });
}

function fetchAllChannels(callback) {
    console.log("=== Lade alle Channels ===");
    
    fetchAPI("https://prometheus.nixos.org/api/v1/query?query=channel_update_time", function(updateResult) {
        if (updateResult.status !== "success") {
            callback([]);
            return;
        }
        
        fetchAPI("https://prometheus.nixos.org/api/v1/query?query=channel_revision", function(revResult) {
            var channels = parseAllChannels(updateResult.data, 
                revResult.status === "success" ? revResult.data : null);
            callback(channels);
        });
    });
}

function findChannelInResponse(response, channelName) {
    if (!response.data || !response.data.result) return null;
    
    for (var i = 0; i < response.data.result.length; i++) {
        var item = response.data.result[i];
        if (item.metric.channel === channelName) {
            var timestamp = parseFloat(item.value[1]);
            return {
                channel: channelName,
                timestamp: timestamp,
                date: new Date(timestamp * 1000)
            };
        }
    }
    return null;
}

function findRevisionForChannel(response, channelName) {
    if (!response.data || !response.data.result) return { commit: "", fullCommit: "" };
    
    for (var i = 0; i < response.data.result.length; i++) {
        var item = response.data.result[i];
        if (item.metric.channel === channelName) {
            var revision = item.metric.revision || "";
            return {
                commit: revision.substring(0, 7),
                fullCommit: revision
            };
        }
    }
    return { commit: "", fullCommit: "" };
}

function parseAllChannels(updateData, revisionData) {
    if (!updateData.data || !updateData.data.result) return [];
    
    var revisionMap = {};
    if (revisionData && revisionData.data && revisionData.data.result) {
        revisionData.data.result.forEach(function(item) {
            var revision = item.metric.revision || "";
            revisionMap[item.metric.channel] = {
                commit: revision.substring(0, 7),
                fullCommit: revision
            };
        });
    }
    
    var channels = updateData.data.result.map(function(item) {
        var channelName = item.metric.channel;
        var timestamp = parseFloat(item.value[1]);
        var date = new Date(timestamp * 1000);
        var revision = revisionMap[channelName] || { commit: "", fullCommit: "" };
        
        return {
            channel: channelName,
            lastUpdated: formatDateTime(date),
            rawDateTime: date.toISOString(),
            timestamp: timestamp,
            commit: revision.commit,
            fullCommit: revision.fullCommit
        };
    });
    
    channels.sort(function(a, b) {
        return a.channel.localeCompare(b.channel);
    });
    
    console.log("✓", channels.length, "Channels geladen");
    return channels;
}

function formatDateTime(date) {
    var now = new Date();
    var diffMs = now - date;
    var diffMinutes = Math.floor(diffMs / (1000 * 60));
    var diffHours = Math.floor(diffMinutes / 60);
    var diffDays = Math.floor(diffHours / 24);
    
    if (diffMinutes < 1) return tr("gerade eben", "just now");
    if (diffMinutes < 60) {
        return tr("vor %1 Minute", "vor %1 Minuten", "%1 minute ago", "%1 minutes ago", diffMinutes);
    }
    if (diffHours < 24) {
        return tr("vor %1 Stunde", "vor %1 Stunden", "%1 hour ago", "%1 hours ago", diffHours);
    }
    if (diffDays < 30) {
        return tr("vor %1 Tag", "vor %1 Tagen", "%1 day ago", "%1 days ago", diffDays);
    }
    return Qt.formatDate(date, "dd.MM.yyyy");
}

function setTranslateFunction(trFunc) {
    translateFunc = trFunc;
}

function tr(de, en) {
    if (translateFunc) {
        return translateFunc(de, en);
    }
    return en;
}

function tr(deSingular, dePlural, enSingular, enPlural, count) {
    if (!translateFunc) {
        // Fallback auf Englisch
        if (arguments.length === 2) {
            return dePlural; // dePlural ist eigentlich enSingular in diesem Fall
        }
        return count === 1 ? enSingular.replace("%1", count) : enPlural.replace("%1", count);
    }
    
    var lang = translateFunc("de", "en"); // Erkenne aktuelle Sprache
    var isGerman = lang === "de";
    var text = "";
    
    if (arguments.length === 2) {
        // Einfache Übersetzung ohne Plural
        return translateFunc(deSingular, dePlural);
    } else {
        // Mit Plural
        if (isGerman) {
            text = count === 1 ? deSingular : dePlural;
        } else {
            text = count === 1 ? enSingular : enPlural;
        }
        return text.replace("%1", count);
    }
}
