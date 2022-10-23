
const Discord = require('discord.js');
const ytdl = require('ytdl-core');

const {getVoiceConnection,createAudioResource, createAudioPlayer ,joinVoiceChannel } = require('@discordjs/voice');
 
const { YTSearcher } = require('ytsearcher');

 
const searcher = new YTSearcher({
    key: process.env.youtubeAPI_token,
    revealed: true
});
 
const { Client, Intents } = require('discord.js');

const client = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES , Intents.FLAGS.GUILD_VOICE_STATES] });
 
const queue = new Map();
let connection
var state = ''
let vc
let player 
        
client.on("ready", () => {
    console.log("online!")
    client.user.setActivity('!help', { type: 'LISTENING'});
})
 
client.on("message", async(message) => {
    const prefix = '!';

    const serverQueue = queue.get(message.guild.id);
 
    const args = message.content.slice(prefix.length).trim().split(/ +/g)
    const command = args.shift().toLowerCase();

    switch(command){
        case 'play':
            execute(message, serverQueue , state);
            break;
        case 'p':
            execute(message, serverQueue , state);
            break;
        case 'stop':
            if (connection !== null  && connection !== undefined ){
                stop(message, serverQueue);
                state = 'stop' 
            }
            break;
        case 'skip':
            skip(message, serverQueue);
            break;
        case 'leave':
            if (message.guild.me.voice.channel !== undefined) {
                //const connection = getVoiceConnection(message.guild.id)
                state = 'leave'
                if (connection){
                    connection.destroy()
                    connection = null
                }
            }
            break;
        case 'help':
            help(message)
            break;
    }
 
    async function execute(message, serverQueue , state1){
       vc = message.member.voice.channel;
       let song
        if(!vc){
            return message.channel.send("Please join a voice chat first");
        }else {
            if (ytdl.validateURL(args[0])){
                const songInfo = await ytdl.getInfo(args[0]);
                console.log(songInfo.videoDetails.title)
                song = {
                    title: songInfo.videoDetails.title,
                    url: songInfo.videoDetails.video_url
                };
            }
            else{
                let result = await searcher.search(args.join(" "), { type: "video" || "audio"})
                if (result.first == null){
                    message.channel.send(`Unable to find related song for ${args[0]}.`)
                    return
                }
                const songInfo = await  ytdl.getInfo(result.first.url)
                song = {
                    title: songInfo.videoDetails.title,
                    url: songInfo.videoDetails.video_url
                };
            }
            if(!serverQueue || state1 === 'leave' || state1 === 'stop'){
                state = ''
                const queueConstructor = {
                    txtChannel: message.channel,
                    vChannel: vc,
                    connection: null,
                    songs: [],
                    volume: 10,
                    playing: true
                };
                queue.set(message.guild.id, queueConstructor);
 
                queueConstructor.songs.push(song);
 
                try{
                    connection = joinVoiceChannel({
                        channelId: message.member.voice.channel.id,
                        guildId: message.guild.id,
                        adapterCreator: message.guild.voiceAdapterCreator,
                        selfDeaf: false,
                        selfMute: false 
                        });

                    queueConstructor.connection = connection;
                    play(message.guild, queueConstructor.songs[0]);
                }catch (err){
                    console.error(err);
                    queue.delete(message.guild.id);
                    return message.channel.send(`Unable to join the voice chat ${err}`)
                }
            }else if(serverQueue.songs.length == 0){
                serverQueue.songs.push(song);
                initMusic(serverQueue)
            }else{
                serverQueue.songs.push(song);
                const embed = new Discord.MessageEmbed()
                .setTitle('The song added to Queue')
                .setColor('#C27C0E')
                .addFields(
                    {name: `${song.title}`,
                    value: `${song.url} \n Queue's length ${serverQueue.songs.length}`}
                )
                return message.channel.send({embeds: [embed]});
            }
        }
    }

    function play(guild, song){

        const serverQueue = queue.get(guild.id);
        if(!song){
            serverQueue.vChannel.leave();
            queue.delete(guild.id);
            return;
        }
        initMusic(serverQueue);
    }

    function stop (message, serverQueue){

        if(!message.member.voice.channel)
            return message.channel.send("You need to join the voice chat first! Bronx city , real hood")
        serverQueue.songs = [];
        player.stop()
    }

    function skip (message, serverQueue){

        if(!message.member.voice.channel)
            return message.channel.send("You need to join the voice chat first! Bronx city , real hood");
        if(!serverQueue || serverQueue.songs.length == 0)
            return message.channel.send("There is nothing to skip!");
        if (serverQueue.songs.length > 1){
            player.stop()
            return 
        }
        if (serverQueue.songs.length == 1)
            stop(message , serverQueue);
    }

    function help(message){
        const embed = new Discord.MessageEmbed()
        .setTitle('Commands list')
        .setColor('#11806A')
        .addFields(
            {name: 'Listening to',
            value: '!play or !p \n !stop \n !skip \n !leave'}
        )
        message.channel.send({embeds: [embed]});
    }

})


client.on('voiceStateUpdate' , (oldS , newS) => {

    if (newS.channelID === undefined && (vc !== undefined && vc !== null) && connection) {
        console.log('a user left!')
        console.log(`${vc.members.size} state: ${state}`)
        if(vc.members.size == 1 && state !== 'leave'){
            state = 'leave'
            console.log(`connection : ${connection}`)
            if (connection){
                connection.destroy();
                connection = null
            }
         }  
    }
})

    function initMusic(serverQueue){

        const song = serverQueue.songs[0]
        player = createAudioPlayer();
        const stream = ytdl(song.url, {
            filter: "audioonly",
            highWaterMark: 1<<25
        });

        const resource = createAudioResource(stream , { inlineVolume: true });
        player.play(resource)
        connection.subscribe(player)

        const embed = new Discord.MessageEmbed()
                .setTitle(`Now playing ${song.title}`)
                .setColor('#11806A')
                .addFields(
                    {name: `Varia plati - Elafria trike. `,
                    value: `${song.url} \n Queue's length ${serverQueue.songs.length}`}
                )

        serverQueue.txtChannel.send({embeds: [embed]});

        player.addListener('stateChange', (oldOne, newOne) => {
            
            console.log(`status : ${newOne.status}`)
            if (newOne.status == 'idle'){
                console.log(`songs length : ${serverQueue.songs.length}`)   
                serverQueue.songs.shift();
                   // console.log(`songs length : ${serverQueue.songs.length}`)
                    if (serverQueue.songs.length > 0){
                        console.log(serverQueue.songs.length)
                        initMusic(serverQueue);
                    }             
            }
        })
    }
 
client.login(process.env.discordAPI_token)
