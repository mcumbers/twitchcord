const Client = require('node-rest-client').Client;
const schedule = require('node-schedule');
const twitch = require('twitch.tv');
const jsonfile = require('jsonfile');

const restClient = new Client();
const twitchAuth = { apiVersion: 5, clientID: "" };
const config = 'config.json';

let job = schedule.scheduleJob('/1 * * * * *', () => {
	//This job will run once per minute
	console.log("Job Started.");
	//Getting info from config.json
	jsonfile.readFile(config, (err, streams) => {
		if(!err){
			console.log("Config Loaded, checking streams...");
			//Looping through each tracked stream
			for(let i = 0; i <= streams.length-1; i++){
				console.log(`Checking Twitch ID ${streams[i].id}`);
				//Getting stream info from twitch API
				twitch(`streams/${streams[i].id}`, twitchAuth, (err, twitchRes) =>{
					if(err){
						console.log(err);
					} else if(twitchRes.stream){
						//Stream is active!
						//Checking to see if we've already sent out notifications for this one yet
						if(streams[i].latestStream !== twitchRes.stream._id){
							//This is the first time we've seen this stream! Time to send out notifications!
							console.log(`Twitch ID ${streams[i].id} (${streams[i].nickname}) has started streaming!`);

							//But first we're going to update our config with the info of this stream
							streams[i].latestStream = twitchRes.stream._id;
							jsonfile.writeFile(config, streams, (err) => {if(err){console.log(err);}});

							//Patching bug where webhooks won't send if streamer hasn't specified a game on Twitch
							if(!twitchRes.stream.game){
								twitchRes.stream.game = "Not Playing";
							}

							//Now, on to notifications!
							//Iterate through each reciever for this stream
							streams[i].recievers.forEach((reciever) => {
								//Building the webhook
								let args = {
									data: {
										"username": `${twitchRes.stream.channel.display_name}`,
										"avatar_url": `${twitchRes.stream.channel.logo}`,
										"content": `${reciever.customMessage}`,
										"embeds": [{
								        	"author": {
								        	    "name": `${twitchRes.stream.channel.display_name}`,
								        	    "icon_url": `${twitchRes.stream.channel.logo}`
								        	},
								        	"title": `🔴 LIVE: ${twitchRes.stream.channel.status}`,
								        	"url": `${twitchRes.stream.channel.url}`,
								        	"color": 6570404,
								        	"fields": [{
								        	        "name": "Game",
								        	        "value": `${twitchRes.stream.game}`,
								        	        "inline": true
								        	    },
								        	    {
								        	        "name": "Viewers",
								        	        "value": `${twitchRes.stream.viewers}`,
								        	        "inline": true
								        	    }
								        	],
								        	"image": {
								        	    "url": `${twitchRes.stream.preview.large}`
								        	},
								        	"thumbnail": {
								        		"url": `${twitchRes.stream.channel.logo}`
								        	},
								        	"footer": {
								        		"text": `/${twitchRes.stream.channel.name}`,
								        		"icon_url": `https://cdn.discordapp.com/attachments/250501026958934020/313483431088619520/GlitchBadge_Purple_256px.png`
								        	}
								    	}]
									},
									headers: {
										"Content-Type": "application/json"
									}
								};

								//Sending the Webhook
								restClient.post(reciever.webhook, args, function(data, webhookResponse) {
									console.log(`Sent webhook to ${reciever.nickname}`);
								});
							});

						} else {
							//We've already sent out notifications for this stream. No need to do it again!
							console.log(`Already tracked this stream from Twitch ID ${streams[i].id} (${streams[i].nickname})`);
						}
					} else {
						//No stream info returned, means user isn't streaming right now
						console.log(`Twitch ID ${streams[i].id} (${streams[i].nickname}) is not live`);
					}
				});
			}
		} else {
			console.log(err);
		}
	});
});