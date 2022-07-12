import { useState, useEffect, useRef } from 'react';
import { v4 as uuid } from 'uuid';

import SendbirdChat from '@sendbird/chat';
import {
    OpenChannelModule,
    OpenChannelHandler,
} from '@sendbird/chat/openChannel';

import { SENDBIRD_INFO } from '../constants/constants';
import { timestampToTime, handleKeyPress } from '../utils/messageUtils';

let sb;

const OpenChannelCategorizeMessagesByCustomType = (props) => {

    const [state, updateState] = useState({
        currentlyJoinedChannel: null,
        currentlyUpdatingChannel: null,
        messages: [],
        channels: [],
        showChannelCreate: false,
        showAddCustomTypeToMessage: false,
        currentMessageCustomType: null,
        selectedMessageCustomType: 'all',
        messageInputValue: "",
        userNameInputValue: "",
        userIdInputValue: "",
        channelNameInputValue: "",
        settingUpUser: true,
        file: null,
        messageToUpdate: null,
        loading: false,
        error: false
    });

    //need to access state in message reeived callback
    const stateRef = useRef();
    stateRef.current = state;

    const channelRef = useRef();

    const scrollToBottom = (item, smooth) => {
        item?.scrollTo({
            top: item.scrollHeight,
            behavior: smooth
        })
    }

    useEffect(() => {
        scrollToBottom(channelRef.current)
    }, [state.currentlyJoinedChannel])

    useEffect(() => {
        scrollToBottom(channelRef.current, 'smooth')
    }, [state.messages])

    const messageCustomTypeRef = useRef();

    const onError = (error) => {
        updateState({ ...state, error: error.message });
        console.log(error);
    }

    const handleJoinChannel = async (channelUrl) => {
        if (state.currentlyJoinedChannel?.url === channelUrl) {
            return null;
        }
        const { channels } = state;
        updateState({ ...state, loading: true });
        const channelToJoin = channels.find((channel) => channel.url === channelUrl);
        const [channel, messages, error] = await joinChannel(channelToJoin);
        if (error) {
            return onError(error);

        }

        //listen for incoming messages
        const channelHandler = new OpenChannelHandler();
        channelHandler.onMessageUpdated = (channel, message) => {
            const messageIndex = stateRef.current.messages.findIndex((item => item.messageId == message.messageId));
            const updatedMessages = [...stateRef.current.messages];
            updatedMessages[messageIndex] = message;
            updateState({ ...stateRef.current, messages: updatedMessages });
        }

        channelHandler.onMessageReceived = (channel, message) => {
            const updatedMessages = [...stateRef.current.messages, message];
            updateState({ ...stateRef.current, messages: updatedMessages });
        };

        channelHandler.onMessageDeleted = (channel, message) => {
            const updatedMessages = stateRef.current.messages.filter((messageObject) => {
                return messageObject.messageId !== message;
            });
            updateState({ ...stateRef.current, messages: updatedMessages });
        }
        sb.openChannel.addOpenChannelHandler(uuid(), channelHandler);
        updateState({ ...state, currentlyJoinedChannel: channel, messages: messages, loading: false })
    }

    const handleLeaveChannel = async () => {
        const { currentlyJoinedChannel } = state;
        await currentlyJoinedChannel.exit();

        updateState({ ...state, currentlyJoinedChannel: null })

    }

    const handleCreateChannel = async () => {
        const { channelNameInputValue } = state;
        const [openChannel, error] = await createChannel(channelNameInputValue);
        if (error) {
            return onError(error);
        }
        const updatedChannels = [openChannel, ...state.channels];
        updateState({ ...state, channels: updatedChannels, showChannelCreate: false });
    }

    const handleDeleteChannel = async (channelUrl) => {
        const [channel, error] = await deleteChannel(channelUrl);
        if (error) {
            return onError(error);
        }
        const updatedChannels = state.channels.filter((channel) => {
            return channel.url !== channelUrl;
        });
        updateState({ ...state, channels: updatedChannels });
    }

    const handleUpdateChannel = async () => {
        const { currentlyUpdatingChannel, channelNameInputValue, channels } = state;
        const [updatedChannel, error] = await updateChannel(currentlyUpdatingChannel, channelNameInputValue);
        if (error) {
            return onError(error);
        }
        const indexToReplace = channels.findIndex((channel) => channel.url === currentlyUpdatingChannel.channelUrl);
        const updatedChannels = [...channels];
        updatedChannels[indexToReplace] = updatedChannel;
        updateState({ ...state, channels: updatedChannels, currentlyUpdatingChannel: null });
    }

    const handleAddCustomTypeToMessage = async () => {
        const { messageToUpdate, currentlyJoinedChannel, messages } = state;

        if (messageToUpdate) {
            const userMessageUpdateParams = {};
            userMessageUpdateParams.customType = messageCustomTypeRef.current.value;
            const updatedMessage = await currentlyJoinedChannel.updateUserMessage(messageToUpdate.messageId, userMessageUpdateParams);
            const messageIndex = messages.findIndex((item => item.messageId == messageToUpdate.messageId));
            messages[messageIndex] = updatedMessage;
            updateState({
                ...state,
                messages: messages,
                messageInputValue: "",
                messageToUpdate: null,
                showAddCustomTypeToMessage: false
            });
        } else {
            updateState({
                ...state,
                currentMessageCustomType: messageCustomTypeRef.current.value,
                showAddCustomTypeToMessage: false
            });
        }
    }

    const handleChangeSelectedMessageCustomType = (e) => {
        updateState({ ...state, selectedMessageCustomType: e.target.value });
    }

    const toggleChannelDetails = (channel) => {
        if (channel) {
            updateState({ ...state, currentlyUpdatingChannel: channel });
        } else {
            updateState({ ...state, currentlyUpdatingChannel: null });
        }
    }

    const toggleShowCreateChannel = () => {
        updateState({ ...state, showChannelCreate: !state.showChannelCreate });
    }

    const toggleShowAddCustomTypeToMessage = () => {
        updateState({ ...state, showAddCustomTypeToMessage: !state.showAddCustomTypeToMessage });
    }

    const onChannelNamenIputChange = (e) => {
        const channelNameInputValue = e.currentTarget.value;
        updateState({ ...state, channelNameInputValue });
    }

    const onUserNameInputChange = (e) => {
        const userNameInputValue = e.currentTarget.value;
        updateState({ ...state, userNameInputValue });
    }

    const onUserIdInputChange = (e) => {
        const userIdInputValue = e.currentTarget.value;
        updateState({ ...state, userIdInputValue });
    }

    const onMessageInputChange = (e) => {
        const messageInputValue = e.currentTarget.value;
        updateState({ ...state, messageInputValue });
    }

    const sendMessage = async () => {
        const { messageToUpdate, currentlyJoinedChannel, messages } = state;

        if (messageToUpdate) {
            const userMessageUpdateParams = {};
            userMessageUpdateParams.message = state.messageInputValue;
            userMessageUpdateParams.customType = state.currentMessageCustomType;
            const updatedMessage = await currentlyJoinedChannel.updateUserMessage(messageToUpdate.messageId, userMessageUpdateParams)
            const messageIndex = messages.findIndex((item => item.messageId == messageToUpdate.messageId));
            messages[messageIndex] = updatedMessage;
            updateState({ ...state, messages: messages, messageInputValue: "", messageToUpdate: null });
        } else {
            const userMessageParams = {};
            userMessageParams.message = state.messageInputValue;
            userMessageParams.customType = state.currentMessageCustomType;
            currentlyJoinedChannel.sendUserMessage(userMessageParams).onSucceeded((message) => {
                const updatedMessages = [...messages, message];
                updateState({ ...state, messages: updatedMessages, messageInputValue: "" });

            }).onFailed((error) => {
                console.log(error)
                console.log("failed")
            });

        }
    }

    const onFileInputChange = async (e) => {
        if (e.currentTarget.files && e.currentTarget.files.length > 0) {
            const { currentlyJoinedChannel, messages } = state;
            const fileMessageParams = {};
            fileMessageParams.file = e.currentTarget.files[0];
            currentlyJoinedChannel.sendFileMessage(fileMessageParams).onSucceeded((message) => {
                const updatedMessages = [...messages, message];
                updateState({ ...state, messages: updatedMessages, messageInputValue: "", file: null });

            }).onFailed((error) => {
                console.log(error)
                console.log("failed")
            });
        }
    }

    const handleDeleteMessage = async (messageToDelete) => {
        const { currentlyJoinedChannel } = state;
        await deleteMessage(currentlyJoinedChannel, messageToDelete); // Delete

    }

    const updateMessage = async (message) => {
        updateState({
            ...state,
            messageToUpdate: message,
            messageInputValue: message.message,
            currentMessageCustomType: message.customType
        });
    }

    const setupUser = async () => {
        const { userNameInputValue, userIdInputValue } = state;
        const sendbirdChat = await SendbirdChat.init({
            appId: SENDBIRD_INFO.appId,
            localCacheEnabled: false,
            modules: [new OpenChannelModule()]
        });

        try {
            await sendbirdChat.connect(userIdInputValue);
        } catch (e) {
            console.log("error", e)
        }
        await sendbirdChat.setChannelInvitationPreference(true);

        const userUpdateParams = {};
        userUpdateParams.nickname = userNameInputValue;
        userUpdateParams.userId = userIdInputValue;
        await sendbirdChat.updateCurrentUserInfo(userUpdateParams);

        sb = sendbirdChat;
        updateState({ ...state, loading: true });
        const [channels, error] = await loadChannels();
        if (error) {
            return onError(error);
        }
        updateState({ ...state, channels: channels, loading: false, settingUpUser: false });
    }

    const handleKeyDown = (event) => {
        if (event.key === 'Enter') {
            sendMessage()
        }
    }

    if (state.loading) {
        return <div>Loading...</div>
    }

    if (state.error) {
        return <div className="error">{state.error} check console for more information.</div>
    }

    console.log('- - - - State object very useful for debugging - - - -');
    console.log(state);

    return (
        <>
            <CreateUserForm
                setupUser={setupUser}
                userNameInputValue={state.userNameInputValue}
                userIdInputValue={state.userIdInputValue}
                settingUpUser={state.settingUpUser}
                onUserIdInputChange={onUserIdInputChange}
                onUserNameInputChange={onUserNameInputChange} />
            <ChannelList
                channels={state.channels}
                toggleChannelDetails={toggleChannelDetails}
                handleJoinChannel={handleJoinChannel}
                toggleShowCreateChannel={toggleShowCreateChannel}
                handleDeleteChannel={handleDeleteChannel} />
            <ChannelDetails
                currentlyUpdatingChannel={state.currentlyUpdatingChannel}
                handleUpdateChannel={handleUpdateChannel}
                onChannelNamenIputChange={onChannelNamenIputChange}
                toggleChannelDetails={toggleChannelDetails} />
            <ChannelCreate
                showChannelCreate={state.showChannelCreate}
                toggleShowCreateChannel={toggleShowCreateChannel}
                onChannelNamenIputChange={onChannelNamenIputChange}
                handleCreateChannel={handleCreateChannel} />
            <Channel
                messages={state.messages}
                currentlyJoinedChannel={state.currentlyJoinedChannel}
                selectedMessageCustomType={state.selectedMessageCustomType}
                handleLeaveChannel={handleLeaveChannel}
                handleChangeSelectedMessageCustomType={handleChangeSelectedMessageCustomType}
                channelRef={channelRef}
            >
                <MessagesList
                    messages={state.messages}
                    selectedMessageCustomType={state.selectedMessageCustomType}
                    handleDeleteMessage={handleDeleteMessage}
                    updateMessage={updateMessage}
                />
                <MessageInput
                    value={state.messageInputValue}
                    onChange={onMessageInputChange}
                    sendMessage={sendMessage}
                    fileSelected={state.file}
                    onFileInputChange={onFileInputChange}
                    toggleShowAddCustomTypeToMessage={toggleShowAddCustomTypeToMessage}
                    handleKeyDown={handleKeyDown} />
            </Channel>
            <AddCustomTypeToMessage
                messageCustomTypeRef={messageCustomTypeRef}
                showAddCustomTypeToMessage={state.showAddCustomTypeToMessage}
                currentMessageCustomType={state.currentMessageCustomType}
                toggleShowAddCustomTypeToMessage={toggleShowAddCustomTypeToMessage}
                handleAddCustomTypeToMessage={handleAddCustomTypeToMessage} />
        </>
    );
};

// Chat UI Components
const ChannelList = ({ channels, handleJoinChannel, toggleShowCreateChannel, handleDeleteChannel, toggleChannelDetails }) => {
    return (
        <div className='channel-list'>
            <div className="channel-type">
                <h1>Open Channels</h1>
                <button className="channel-create-button" onClick={toggleShowCreateChannel}>Create Channel</button>
            </div>
            {
                channels.map(channel => {
                    const userIsOperator = channel.operators.some((operator) => operator.userId === sb.currentUser.userId)
                    return (
                        <div key={channel.url} className="channel-list-item" >
                            <div className="channel-list-item-name"
                                onClick={() => { handleJoinChannel(channel.url) }}>
                                {channel.name}
                            </div>
                            {userIsOperator &&
                                <div>
                                    <button className="control-button" onClick={() => toggleChannelDetails(channel)}>
                                        <img className="channel-icon" src='/icon_edit.png' />

                                    </button>
                                    <button className="control-button" onClick={() => handleDeleteChannel(channel.url)}>
                                        <img className="channel-icon" src='/icon_delete.png' />

                                    </button>
                                </div>}
                        </div>);
                })
            }
        </div >);
}


const Channel = ({ messages, currentlyJoinedChannel, handleLeaveChannel, selectedMessageCustomType, handleChangeSelectedMessageCustomType, children, channelRef }) => {
    if (currentlyJoinedChannel) {
        return <div className="channel" ref={channelRef}>
            <ChannelHeader>{currentlyJoinedChannel.name}</ChannelHeader>
            <div>
                <button className="leave-channel" onClick={handleLeaveChannel}>Exit Channel</button>
                <span className="message-type-label">Sort messages by custom type:</span>
                <select
                    onChange={(e) => handleChangeSelectedMessageCustomType(e)}
                    value={selectedMessageCustomType}
                    className="message-type-select"
                >
                    <option value="all">all</option>
                    {
                        [...new Set(messages
                            .map(message => message.customType)
                            .filter(message => message))
                        ].map(item =>
                            <option value={item} key={item}>{item}</option>)
                    }
                </select>
            </div>
            <div>{children}</div>
        </div>;

    }
    return <div className="channel"></div>;

}

const ChannelHeader = ({ children }) => {
    return <div className="channel-header">{children}</div>;

}

const MessagesList = ({ messages, handleDeleteMessage, updateMessage, selectedMessageCustomType }) => {
    return messages
        .filter(message => selectedMessageCustomType === 'all' ? message : message.customType === selectedMessageCustomType)
        .map(message => {
            return (
                <div key={message.messageId} className="oc-message-item">
                    <Message
                        handleDeleteMessage={handleDeleteMessage}
                        updateMessage={updateMessage}
                        message={message}
                    />
                </div>);
    })
}

const Message = ({ message, updateMessage, handleDeleteMessage }) => {
    if (message.url) {
        return (
            <div className="oc-message">
                <div>{timestampToTime(message.createdAt)}</div>

                <div className="oc-message-sender-name">{message.sender.nickname}{' '}</div>

                <img src={message.url} />
            </div >);
    }

    const messageSentByCurrentUser = message.sender.userId === sb.currentUser.userId;
    return (
        <div className="oc-message">
            <div>{timestampToTime(message.createdAt)}</div>

            <div className="oc-message-sender-name">{message.sender.nickname}{':'}</div>
            <div>{message.message}</div>

            {messageSentByCurrentUser && <>
                <button className="control-button" onClick={() => updateMessage(message)}>
                    <img className="oc-message-icon" src='/icon_edit.png' />
                </button>
                <button className="control-button" onClick={() => handleDeleteMessage(message)}>
                    <img className="oc-message-icon" src='/icon_delete.png' />
                </button>
            </>}


        </div >
    );

}

const MessageInput = ({ value, onChange, sendMessage, onFileInputChange, toggleShowAddCustomTypeToMessage, handleKeyDown }) => {
    return (
        <div className="message-input">
            <input
                placeholder="write a message"
                value={value}
                onChange={onChange}
                onKeyDown={handleKeyDown} />

            <div className="message-input-buttons">
                <button className="send-message-button" onClick={sendMessage}>Send Message</button>
                <label className="file-upload-label" htmlFor="upload" >Select File</label>
                <label className="message-type-add" onClick={toggleShowAddCustomTypeToMessage}>Add custom type</label>

                <input
                    id="upload"
                    className="file-upload-button"
                    type='file'
                    hidden={true}
                    onChange={onFileInputChange}
                    onClick={() => { }}
                />
            </div>

        </div>);
}

const ChannelDetails = ({
    currentlyUpdatingChannel,
    toggleChannelDetails,
    handleUpdateChannel,
    onChannelNamenIputChange
}) => {
    if (currentlyUpdatingChannel) {
        return <div className="overlay">
            <div className="overlay-content">

                <h3>Update Channel Details</h3>
                <div> Channel name</div>
                <input className="form-input" onChange={onChannelNamenIputChange} />

                <button className="form-button" onClick={() => toggleChannelDetails(null)}>Close</button>

                <button onClick={() => handleUpdateChannel()}>Update channel name</button>
            </div>
        </div >;
    }
    return null;
}

const ChannelCreate = ({
    showChannelCreate,
    toggleShowCreateChannel,
    handleCreateChannel,
    onChannelNamenIputChange
}) => {
    if (showChannelCreate) {
        return <div className="overlay">
            <div className="overlay-content">
                <div>
                    <h3>Create Channel</h3>
                </div>
                <div>Name</div>
                <input className="form-input" onChange={onChannelNamenIputChange} onKeyDown={(event) => handleKeyPress(event, handleCreateChannel)} />
                <div>
                    <button className="form-button" onClick={handleCreateChannel}>Create</button>
                    <button className="form-button" onClick={toggleShowCreateChannel}>Cancel</button>
                </div>

            </div>
        </div >;
    }
    return null;
}

const CreateUserForm = ({
    setupUser,
    settingUpUser,
    userNameInputValue,
    userIdInputValue,
    onUserNameInputChange,
    onUserIdInputChange
}) => {
    if (settingUpUser) {
        return <div className="overlay">
            <div className="overlay-content" onKeyDown={(event) => handleKeyPress(event, setupUser)}>
                <div>User ID</div>

                <input
                    onChange={onUserIdInputChange}
                    className="form-input"
                    type="text" value={userIdInputValue} />

                <div>User Nickname</div>
                <input
                    onChange={onUserNameInputChange}
                    className="form-input"
                    type="text" value={userNameInputValue} />

                <div>

                    <button
                        className="user-submit-button"
                        onClick={setupUser}>Connect</button>
                </div>
            </div>

        </div>
    } else {
        return null;
    }

}

const AddCustomTypeToMessage = ({
    showAddCustomTypeToMessage,
    toggleShowAddCustomTypeToMessage,
    messageCustomTypeRef,
    handleAddCustomTypeToMessage,
    currentMessageCustomType
}) => {
    if (showAddCustomTypeToMessage) {
        return <div className="overlay">
            <div className="overlay-content">
                <div>
                    <h3>Add custom type to message</h3>
                </div>
                <div>Custom type</div>
                <input className="form-input" ref={messageCustomTypeRef} defaultValue={currentMessageCustomType} />
                <div>
                    <button className="form-button" onClick={handleAddCustomTypeToMessage}>Save</button>
                    <button className="form-button" onClick={toggleShowAddCustomTypeToMessage}>Cancel</button>
                </div>

            </div>
        </div >;
    }
    return null;
}

// Helpful functions that call Sendbird
const loadChannels = async () => {
    try {
        const openChannelQuery = sb.openChannel.createOpenChannelListQuery({ limit: 30 });
        const channels = await openChannelQuery.next();
        return [channels, null];

    } catch (error) {
        return [null, error];
    }

}

const joinChannel = async (channel) => {
    try {
        await channel.enter();
        //list all messages
        const messageListParams = {};
        messageListParams.nextResultSize = 20;
        const messages = await channel.getMessagesByTimestamp(0, messageListParams);
        return [channel, messages, null];
    } catch (error) {
        return [null, null, error]
    }
}


const createChannel = async (channelName) => {
    try {
        const openChannelParams = {};
        openChannelParams.name = channelName;
        openChannelParams.operatorUserIds = [sb.currentUser.userId];
        const openChannel = await sb.openChannel.createChannel(openChannelParams);
        return [openChannel, null];
    } catch (error) {
        return [null, error];
    }

}

const deleteChannel = async (channelUrl) => {
    try {
        const channel = await sb.openChannel.getChannel(channelUrl);
        await channel.delete();
        return [channel, null];
    } catch (error) {
        return [null, error];
    }

}

const updateChannel = async (currentlyUpdatingChannel, channelNameInputValue) => {
    try {
        const channel = await sb.openChannel.getChannel(currentlyUpdatingChannel.url);
        const openChannelParams = {};
        openChannelParams.name = channelNameInputValue;

        openChannelParams.operatorUserIds = [sb.currentUser.userId];

        const updatedChannel = await channel.updateChannel(openChannelParams);
        return [updatedChannel, null];
    } catch (error) {
        return [null, error];
    }
}

const deleteMessage = async (currentlyJoinedChannel, messageToDelete) => {
    await currentlyJoinedChannel.deleteMessage(messageToDelete);
}

export default OpenChannelCategorizeMessagesByCustomType;