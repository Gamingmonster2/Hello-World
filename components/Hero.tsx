/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';

export const Hero: React.FC = () => {
  return (
    <div className="text-center relative z-10 max-w-4xl mx-auto px-4">
      <h1 className="text-5xl md:text-7xl font-medium tracking-tight text-white mb-4">
        <span className="opacity-90">Hi, how can I </span>
        <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-400 to-red-400 font-bold">help</span>?
      </h1>
      <p className="text-xl text-zinc-400 font-light">
        Voice-Activated Generative Browser
      </p>
    </div>
  );
};