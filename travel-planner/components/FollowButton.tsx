"use client";
import React from 'react';

export default function FollowButton() {
  const [following, setFollowing] = React.useState(false);
  return (
    <button
      type="button"
      onClick={() => setFollowing((v) => !v)}
      className={`px-3 py-1 rounded-full font-semibold text-sm transition ${following ? 'bg-indigo-600 text-white' : 'bg-white/6 text-white'}`}
      aria-pressed={following}
    >
      {following ? 'Following' : 'Follow'}
    </button>
  );
}
