import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Home from './Home';
import BasicOpenChannelSample from './samples/BasicOpenChannelSample';
import BasicGroupChannelSample from './samples/BasicGroupChannelSample';
import GroupChannelTypingIndicatorSample from './samples/GroupChannelTypingIndicatorSample';
import FreezeOpenChannelSample from './samples/FreezeOpenChannelSample';
import GroupChannelMessageThreading from './samples/GroupChannelMessageThreading'

const App = () => {
  return (
    <div className="container">
      <Routes>
        <Route path='/' element={<Home />} />
        <Route path='/open-channel' element={<BasicOpenChannelSample />} />
        <Route path='/group-channel' element={<BasicGroupChannelSample />} />
        <Route path='/group-channel-typing-indicator' element={<GroupChannelTypingIndicatorSample />} />
        <Route path='/freeze-open-channel' element={<FreezeOpenChannelSample />} />
        <Route path='/group-channel-message-threading' element={<GroupChannelMessageThreading />} />
      </Routes>
    </div>
  );
}

export default App;
