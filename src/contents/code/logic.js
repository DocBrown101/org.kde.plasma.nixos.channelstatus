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
            try {
                respond({status: "success", data: JSON.parse(xhr.responseText)});
            } catch (e) {
                respond({status: "network_error", error: tr(lang, "Ungültige API-Antwort", "Invalid API response")});
            }
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

function fetchChannelsStatus(callback, lang) {
    console.log("=== Lade gebündelte Channel-Daten ===");

    fetchAPI("https://prometheus.nixos.org/api/v1/query?query=channel_update_time", function(updateResult) {
        if (updateResult.status !== "success") {
            callback({status: "network_error", channels: [], error: updateResult.error});
            return;
        }
        if (!isValidPrometheusResponse(updateResult.data)) {
            callback({status: "network_error", channels: [], error: tr(lang, "Ungültige API-Antwort", "Invalid API response")});
            return;
        }

        fetchAPI("https://prometheus.nixos.org/api/v1/query?query=channel_revision", function(revResult) {
            var revisionData = revResult.status === "success" && isValidPrometheusResponse(revResult.data) ? revResult.data : null;
            var channels = parseAllChannels(
                updateResult.data,
                revisionData,
                lang
            );

            callback({
                status: "success",
                channels: channels,
                revisionStatus: revResult.status
            });
        }, lang);
    }, lang);
}

function isValidPrometheusResponse(response) {
    return response &&
            response.status === "success" &&
            response.data &&
            response.data.result &&
            typeof response.data.result.length === "number";
}

function getChannelName(version) {
    if (!version) return "nixos-";
    return version.indexOf("nixos-") === 0 ? version : "nixos-" + version;
}

function getVersionFromChannel(channelName) {
    if (!channelName) return "";
    return channelName.indexOf("nixos-") === 0 ? channelName.substring(6) : channelName;
}

function findChannelStatusInList(channels, version, lang) {
    var channelName = getChannelName(version);

    for (var i = 0; i < channels.length; i++) {
        if (channels[i].channel === channelName) {
            return {
                lastUpdated: channels[i].lastUpdated,
                rawDateTime: channels[i].rawDateTime,
                timestamp: channels[i].timestamp,
                commit: channels[i].commit,
                fullCommit: channels[i].fullCommit,
                status: "success",
                channel: channelName
            };
        }
    }

    return {
        lastUpdated: tr(lang, "Channel nicht gefunden", "Channel not found"),
        commit: "",
        fullCommit: "",
        status: "not_found",
        channel: channelName
    };
}

function updateRelativeTimes(channels, lang) {
    return channels.map(function(channel) {
        var updatedChannel = {};
        for (var key in channel) {
            updatedChannel[key] = channel[key];
        }

        if (updatedChannel.rawDateTime) {
            updatedChannel.lastUpdated = formatDateTime(new Date(updatedChannel.rawDateTime), lang);
        }

        return updatedChannel;
    });
}

function parseAllChannels(updateData, revisionData, lang) {
    if (!isValidPrometheusResponse(updateData)) return [];

    var revisionMap = {};
    if (revisionData && revisionData.data && revisionData.data.result) {
        revisionData.data.result.forEach(function(item) {
            if (!item.metric || !item.metric.channel) return;
            var revision = item.metric.revision || "";
            revisionMap[item.metric.channel] = {
                commit: revision.substring(0, 7),
                fullCommit: revision
            };
        });
    }

    var channels = updateData.data.result.map(function(item) {
        if (!item.metric || !item.metric.channel || !item.value || item.value.length < 2) {
            return null;
        }

        var channelName = item.metric.channel;
        var timestamp = parseFloat(item.value[1]);
        if (isNaN(timestamp)) {
            return null;
        }

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
    }).filter(function(channel) {
        return channel !== null;
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
