var retryCount = 0;
var maxRetries = 5;
var retryDelay = 5000;
var activeRetryTimer = null;

function tr(lang, de, en) {
    if (arguments.length === 3) {
        return lang === "de" ? de : en;
    }
    // Mit Plural: tr(lang, deSing, dePlur, enSing, enPlur, count)
    var deSingular = de;
    var dePlural = en;
    var enSingular = arguments[3];
    var enPlural = arguments[4];
    var count = arguments[5];
    
    var text = "";
    if (lang === "de") {
        text = count === 1 ? deSingular : dePlural;
    } else {
        text = count === 1 ? enSingular : enPlural;
    }
    return text.replace("%1", count);
}

function fetchAPI(url, callback, lang) {
    var xhr = new XMLHttpRequest();
    var hasResponded = false;

    function respond(payload) {
        if (hasResponded) {
            return;
        }
        hasResponded = true;
        callback(payload);
    }

    xhr.timeout = 10000;
    xhr.onreadystatechange = function() {
        if (xhr.readyState !== XMLHttpRequest.DONE || hasResponded) {
            return;
        }

        if (xhr.status === 200) {
            respond({status: "success", data: JSON.parse(xhr.responseText)});
        } else {
            respond({status: "network_error", error: tr(lang, "Keine Verbindung", "No connection")});
        }
    };
    xhr.onerror = function() {
        respond({status: "network_error", error: tr(lang, "Keine Verbindung", "No connection")});
    };
    xhr.ontimeout = function() {
        respond({status: "network_error", error: "Timeout"});
    };

    try {
        xhr.open("GET", url);
        xhr.send();
    } catch (e) {
        respond({status: "network_error", error: e.toString()});
    }
}

function fetchChannelStatus(version, callback, isRetry, lang) {
    if (!isRetry) {
        retryCount = 0;
        if (activeRetryTimer) {
            activeRetryTimer.stop();
            activeRetryTimer.destroy();
            activeRetryTimer = null;
        }
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
                        {commit: "", fullCommit: ""};

                    var status = {
                        lastUpdated: formatDateTime(channelData.date, lang),
                        rawDateTime: channelData.date.toISOString(),
                        timestamp: channelData.timestamp,
                        commit: revision.commit,
                        fullCommit: revision.fullCommit,
                        status: "success",
                        channel: channelName
                    };

                    callback(status);
                }, lang);
            } else {
                var notFoundStatus = {
                    lastUpdated: tr(lang, "Channel nicht gefunden", "Channel not found"),
                    status: "not_found",
                    channel: channelName
                };
                callback(notFoundStatus);
            }
        } else if (result.status === "network_error" && retryCount < maxRetries) {
            retryCount++;
            console.log("⏳ Retry", retryCount, "/", maxRetries);

            var retryMsg = lang === "de" ? 
                "Verbindungsfehler, Retry " + retryCount + "/" + maxRetries + "..." :
                "Connection error, retry " + retryCount + "/" + maxRetries + "...";

            var retryStatus = {
                lastUpdated: retryMsg,
                status: "retrying",
                channel: channelName,
                retryCount: retryCount,
                maxRetries: maxRetries
            };

            callback(retryStatus);

            try {
                activeRetryTimer = Qt.createQmlObject(
                    'import QtQuick 2.15; Timer { interval: ' + retryDelay + '; repeat: false; running: true }',
                    Qt.application,
                    'retryTimer'
                );
                activeRetryTimer.triggered.connect(function() {
                    fetchChannelStatus(version, callback, true, lang);
                    activeRetryTimer.destroy();
                    activeRetryTimer = null;
                });
            } catch (e) {
                console.log("Retry Timer Fehler", e);
                fetchChannelStatus(version, callback, true, lang);
            }
        } else {
            var errorMsg = retryCount >= maxRetries ? 
                tr(lang, "Keine Verbindung", "No connection") : 
                result.error;
            
            var errorStatus = {
                lastUpdated: errorMsg,
                status: "error",
                channel: channelName
            };
            retryCount = 0;
            callback(errorStatus);
        }
    }, lang);
}

function fetchAllChannels(callback, lang) {
    console.log("=== Lade alle Channels ===");

    fetchAPI("https://prometheus.nixos.org/api/v1/query?query=channel_update_time", function(updateResult) {
        if (updateResult.status !== "success") {
            callback([]);
            return;
        }

        fetchAPI("https://prometheus.nixos.org/api/v1/query?query=channel_revision", function(revResult) {
            var channels = parseAllChannels(
                updateResult.data,
                revResult.status === "success" ? revResult.data : null,
                lang
            );
            callback(channels);
        }, lang);
    }, lang);
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
    if (!response.data || !response.data.result) return {commit: "", fullCommit: ""};

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
    return {commit: "", fullCommit: ""};
}

function parseAllChannels(updateData, revisionData, lang) {
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
        var revision = revisionMap[channelName] || {commit: "", fullCommit: ""};

        return {
            channel: channelName,
            lastUpdated: formatDateTime(date, lang),
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

function formatDateTime(date, lang) {
    var now = new Date();
    var diffMs = now - date;
    var diffMinutes = Math.floor(diffMs / (1000 * 60));
    var diffHours = Math.floor(diffMinutes / 60);
    var diffDays = Math.floor(diffHours / 24);

    if (diffMinutes < 1) return tr(lang, "gerade eben", "just now");
    if (diffMinutes < 60) {
        return tr(lang, "vor %1 Minute", "vor %1 Minuten", "%1 minute ago", "%1 minutes ago", diffMinutes);
    }
    if (diffHours < 24) {
        return tr(lang, "vor %1 Stunde", "vor %1 Stunden", "%1 hour ago", "%1 hours ago", diffHours);
    }
    if (diffDays < 30) {
        var remainingHours = diffHours % 24;
        if (remainingHours >= 12) {
            diffDays = diffDays + "½";
        }
        return tr(lang, "vor %1 Tag", "vor %1 Tagen", "%1 day ago", "%1 days ago", diffDays);
    }
    return Qt.formatDate(date, "dd.MM.yyyy");
}
