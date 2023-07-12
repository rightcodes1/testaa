const disbut = require('discord-buttons');
disbut  // Create a function to handle the appeal button click
 
// Create an object to store the reaction emojis and their meanings
const unbanRequestChannelID = '1128569122503012452';
const buttonMessageChannelID = '1125902820709761106';
const logChannelID = '1128569122503012452';

// Create a collection to store the unban requests
const unbanRequests = new Discord.Collection();

const staffSequence = [];

// Create a variable to store the current index
let currentIndex = 0;

// Listen for ready event
client.on('ready', async () => {
  // Get the button message channel
  const buttonMessageChannel = client.channels.cache.get(buttonMessageChannelID);
  if (!buttonMessageChannel) return console.error('Invalid button message channel ID');

  // Read the JSON file
  fs.readFile('buttonMessage.json', 'utf8', (err, data) => {
    if (err) return console.error(err);

    // Parse the JSON data
    const buttonMessageID = JSON.parse(data).id;

    // Check if the button message ID is valid
    if (!buttonMessageID) return console.error('Invalid button message ID');

    // Fetch the button message from the channel
    buttonMessageChannel.messages.fetch(buttonMessageID)
      .then(buttonMessage => {
        // Check if the button message has a button
        if (!buttonMessage.components[0].components[0]) return console.error('No button found in the message');

        // Listen for clickButton events
        client.on('clickButton', async button => {
          // Ignore buttons that are not the unban request button or the close unban request button
          if (button.id !== 'unban_request' && button.id !== 'close_unban_request') return;

          // Defer the button reply
          await button.reply.defer();

          // Get the button component from the message
          const buttonComponent = button.message.components[0].components[0];
          if (!buttonComponent) return console.error('No button component found in the message');

          // Handle the unban request button
          if (button.id === 'unban_request') {
            // Check if the user already has an unban request
            if (unbanRequests.has(button.clicker.user.id)) return button.reply.send('You already have an unban request.', true);

            // Create a channel with the user's name and permissions
            const channel = await button.message.guild.channels.create(`${button.clicker.user.username}-unban-request`, {
              type: 'text',
              permissionOverwrites: [
                {
                  id: button.message.guild.id,
                  deny: ['VIEW_CHANNEL']
                },
                {
                  id: button.clicker.user.id,
                  allow: ['VIEW_CHANNEL', 'SEND_MESSAGES']
                }
              ]
            });

            // Create a close unban request button
            const closeButton = new disbut.MessageButton()
              .setStyle('red')
              .setLabel('Close Unban Request')
              .setID('close_unban_request');

            // Send a message to the channel with instructions and the close button
            channel.send(`Hello ${button.clicker.user.username}, this is your unban request channel. Please provide your in-game username and explain why you should be unbanned and wait for a staff member to review your case.`, { buttons: [closeButton] });

            // Add the channel ID to the unban requests collection
            unbanRequests.set(button.clicker.user.id, channel.id);

            // Reply to the button with a confirmation message
            button.reply.send('Your unban request has been created.');

            // Send a notification to the unban request channel
            const unbanRequestChannel = button.message.guild.channels.cache.get(unbanRequestChannelID);
            if (unbanRequestChannel) {
              unbanRequestChannel.send(`${button.clicker.user.username}'s Unban Request has been created.`);
            }

            // Get the next staff name from the sequence
            const staffName = staffSequence[currentIndex];

            // Check if there is a staff name available
            if (staffName) {
              // Send a welcome message to the channel with the staff name
              channel.send(`Welcome ${button.clicker.user.username}, ${staffName} or someone of higher rank will come to help you as soon as possible. Until then be patient please.`);

              // Increment the current index and wrap around if necessary
              currentIndex = (currentIndex + 1) % staffSequence.length;
            } else {
              // Send a message to the channel that no staff is available
              channel.send(`Welcome ${button.clicker.user.username}, we are sorry but there is no staff available at the moment. Please wait until someone joins the sequence.`);
            }
          }

          // Handle the close unban request button
          if (button.id === 'close_unban_request') {
            // Get the log channel
            const logChannel = client.channels.cache.get(logChannelID);
            if (!logChannel) return console.error('Invalid log channel ID');

            // Fetch all messages from the channel and save them as a text file
            const messages = await button.message.channel.messages.fetch({ limit: 100 });
            const messagesText = messages.map(m => `${m.author.tag}: ${m.content}`).join('\n');
            fs.writeFile(`${button.message.channel.name}.txt`, messagesText, 'utf8', (err) => {
              if (err) return console.error(err);

              // Send the text file to the log channel
              logChannel.send(`Here is the log of ${button.message.channel.name}`, { files: [`${button.message.channel.name}.txt`] })
                .then(() => {
                  // Delete the text file
                  fs.unlink(`${button.message.channel.name}.txt`, (err) => {
                    if (err) return console.error(err);
                  });

                  // Delete the channel
                  button.message.channel.delete()
                    .then(() => {
                      // Remove the channel ID from the unban requests collection
                      unbanRequests.delete(button.clicker.user.id);

                      // Reply to the button with a confirmation message
                      button.reply.send('The unban request has been closed.');

                      // Send a notification to the unban request channel
                      const unbanRequestChannel = button.message.guild.channels.cache.get(unbanRequestChannelID);
                      if (unbanRequestChannel) {
                        unbanRequestChannel.send(`${button.clicker.user.username}'s Unban Request has been closed.`);
                      }
                    })
                    .catch(error => {
                      // Handle any errors
                      console.error(error);
                      button.reply.send('There was an error deleting the channel. Please try again later.');
                    });
                })
                .catch(error => {
                  // Handle any errors
                  console.error(error);
                  button.reply.send('There was an error sending the log. Please try again later.');
                });
            });
          }
        });
      })
      .catch(error => {
        // Handle any errors
        console.error(error);
      });
  });
});

// Listen for message events
client.on('message', async message => {
  // Ignore messages from bots or without prefix
  if (message.author.bot || !message.content.startsWith(prefix)) return;

  // Get the command and arguments
  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  // Handle the addbutton command
  if (command === 'addbutton') {
    // Check if the user has permission to add buttons
    if (!message.member.hasPermission('MANAGE_MESSAGES')) return message.reply('You don\'t have permission to add buttons.');

    // Get the message ID from the arguments
    const messageID = args[0];
    if (!messageID) return message.reply('Please provide a valid message ID.');

    // Get the message from the button message channel
    const buttonMessageChannel = client.channels.cache.get(buttonMessageChannelID);
    if (!buttonMessageChannel) return console.error('Invalid button message channel ID');
    const buttonMessage = await buttonMessageChannel.messages.fetch(messageID);
    if (!buttonMessage) return message.reply('No message found with that ID.');

    // Create a button with the required message
    const button = new disbut.MessageButton()
      .setStyle('green')
      .setLabel('Click here to create an unban request')
      .setID('unban_request');

    // Edit the message to add the button
    buttonMessage.edit(buttonMessage.content, { buttons: [button] })
      .then(() => {
        // Write the message ID to the JSON file
        fs.writeFile('buttonMessage.json', JSON.stringify({ id: messageID }), 'utf8', (err) => {
          if (err) return console.error(err);
        });

        // Reply with a confirmation message
        message.reply('The button has been added.');
      })
      .catch(error => {
        // Handle any errors
        console.error(error);
        message.reply('There was an error adding the button. Please try again later.');
      });
  }
// Handle the staff-sequence command
if (command === 'staff-sequence') {
  // Check if the user has permission to manage staff sequence
  if (!message.member.hasPermission('MANAGE_ROLES')) return message.reply('You don\'t have permission to manage staff sequence.');

  // Get the subcommand and arguments
  const subcommand = args[0];
  const staffName = args.slice(1).join(' ');

  // Check if the subcommand is valid
  if (!subcommand) return message.reply('Please provide a valid subcommand: add, remove or list.');

  // Handle the add subcommand
  if (subcommand === 'add') {
    // Check if the staff name is valid
    if (!staffName) return message.reply('Please provide a valid staff name.');

    // Check if the staff name is already in the sequence
    if (staffSequence.includes(staffName)) return message.reply('That staff name is already in the sequence.');

    // Add the staff name to the sequence
    staffSequence.push(staffName);

    // Reply with a confirmation message
    message.reply(`The staff name ${staffName} has been added to the sequence.`);
  }

  // Handle the remove subcommand
  if (subcommand === 'remove') {
    // Check if the staff name is valid
    if (!staffName) return message.reply('Please provide a valid staff name.');

    // Check if the staff name is in the sequence
    if (!staffSequence.includes(staffName)) return message.reply('That staff name is not in the sequence.');

    // Remove the staff name from the sequence
    const index = staffSequence.indexOf(staffName);
    staffSequence.splice(index, 1);

    // Adjust the current index if necessary
    if (index < currentIndex) {
      currentIndex--;
    }

    // Reply with a confirmation message
    message.reply(`The staff name ${staffName} has been removed from the sequence.`);
  }

  // Handle the list subcommand
  if (subcommand === 'list') {
    // Check if the sequence is empty
    if (staffSequence.length === 0) return message.reply('The sequence is empty.');

    // Create a string to display the sequence
    let sequenceString = '';
    for (let i = 0; i < staffSequence.length; i++) {
      sequenceString += `${i + 1}. ${staffSequence[i]}\n`;
    }

    // Reply with an embed showing the sequence and the current index
    const embed = new Discord.MessageEmbed()
      .setTitle('Staff Sequence')
      .setDescription(sequenceString)
      .setFooter(`Current index: ${currentIndex + 1}`);
    
    message.reply(embed);
  }
}})
