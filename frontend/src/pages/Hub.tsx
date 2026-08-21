import React, { useState, useEffect } from 'react';
import { Users, Send, Heart, Trash2, RefreshCw, Hash } from 'lucide-react';
import type { Post } from '../types';
import Sidebar from '../components/Sidebar';

const API_BASE_URL = 'http://localhost:5081/api';

const Hub: React.FC = () => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [content, setContent] = useState('');
  const [tags, setTags] = useState('');
  const [searchTag, setSearchTag] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());

  const activeUser = localStorage.getItem('audit_active_user') || 'anonymous';
  const activeSessionId = localStorage.getItem('audit_session_id') || crypto.randomUUID();

  const getHeaders = () => ({
    'Content-Type': 'application/json',
    'X-Session-ID': activeSessionId,
    'X-User-ID': activeUser,
  });

  const fetchPosts = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/post`, {
        headers: getHeaders()
      });
      if (response.ok) {
        const data = await response.json();
        setPosts(data);
      }
    } catch (err) {
      console.error('Failed to load posts:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts();
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('audit_liked_posts');
      if (raw) {
        const arr: string[] = JSON.parse(raw);
        setLikedPosts(new Set(arr));
      }
    } catch (e) {
      console.warn('Failed to load liked posts from storage', e);
    }
  }, []);

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    setIsSubmitting(true);

    const postPayload = {
      author: activeUser,
      content: content.trim(),
      tags: tags.trim(),
    };

    try {
      const response = await fetch(`${API_BASE_URL}/post`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(postPayload),
      });

      if (response.ok) {
        setContent('');
        setTags('');
        fetchPosts();
      }
    } catch (err) {
      console.error('Failed to publish post:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle like on server and update local state from server response
  const handleLikePost = async (id: string) => {
    if (!id) return;
    try {
      const resp = await fetch(`${API_BASE_URL}/post/${id}/like`, {
        method: 'POST',
        headers: getHeaders(),
      });
      if (!resp.ok) throw new Error('Like toggle failed');
      const data = await resp.json();
      const newLikes: number = data.likes;
      const isLiked: boolean = data.isLiked;
      setPosts(prev => prev.map(p => p.id === id ? { ...p, likes: newLikes } : p));
      setLikedPosts(prev => {
        const copy = new Set(prev);
        if (isLiked) copy.add(id);
        else copy.delete(id);
        try { localStorage.setItem('audit_liked_posts', JSON.stringify(Array.from(copy))); } catch {}
        return copy;
      });
    } catch (err) {
      console.error('Failed to toggle like:', err);
    }
  };

  const handleDeletePost = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this post?')) return;

    try {
      const response = await fetch(`${API_BASE_URL}/post/${id}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });

      if (response.ok) {
        fetchPosts();
      }
    } catch (err) {
      console.error('Failed to delete post:', err);
    }
  };

  const filteredPosts = posts.filter(post => {
    if (!searchTag.trim()) return true;
    const cleanSearch = searchTag.trim().replace('#', '').toLowerCase();
    return post.tags.toLowerCase().includes(cleanSearch);
  });

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-main)' }}>
      <Sidebar activePage="hub" />

      <div style={{ flex: 1, marginLeft: '260px', padding: '32px 24px', boxSizing: 'border-box' }}>
        <div style={{ maxWidth: '750px', margin: '0 auto' }}>
          
          {/* Title */}
          <div style={{ marginBottom: '24px' }}>
            <h1 className="neon-title" style={{ fontSize: '24px' }}>
              <Users size={22} style={{ color: 'var(--accent-purple)' }} />
              Achnet Community Hub Feed
            </h1>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Publish updates, search tags, and inspect automatic audit tracing logs in real-time.
            </p>
          </div>

          {/* Compose Post Card */}
          <div className="glass-card" style={{ marginBottom: '24px', padding: '20px' }}>
            <form onSubmit={handleCreatePost} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="input-field"
                  placeholder="What is on your mind today?"
                  rows={3}
                  style={{
                    resize: 'none',
                    fontSize: '14px',
                    padding: '12px',
                    fontFamily: 'inherit',
                    width: '100%',
                  }}
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <Hash
                    size={12}
                    style={{
                      position: 'absolute',
                      left: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: 'var(--text-secondary)',
                    }}
                  />
                  <input
                    type="text"
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    className="input-field"
                    placeholder="skills coding dotnet"
                    style={{
                      paddingLeft: '30px',
                      fontSize: '12px',
                      height: '38px',
                    }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting || !content.trim()}
                  className="btn btn-primary"
                  style={{ height: '38px', padding: '0 16px', fontSize: '13px' }}
                >
                  {isSubmitting ? 'Posting...' : 'Publish'}
                  <Send size={12} />
                </button>
              </div>
            </form>
          </div>

          {/* Tag Filter Inputs */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', width: '220px' }}>
              <Hash size={12} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
              <input
                type="text"
                value={searchTag}
                onChange={(e) => setSearchTag(e.target.value)}
                className="input-field"
                placeholder="Search tag (e.g. dotnet)..."
                style={{ paddingLeft: '28px', fontSize: '12px', height: '34px' }}
              />
            </div>

            <button
              onClick={fetchPosts}
              className="btn btn-secondary"
              style={{ padding: '6px 12px', fontSize: '12px', height: '34px' }}
              disabled={isLoading}
            >
              <RefreshCw size={12} className={isLoading ? 'spin' : ''} />
              Refresh Feed
            </button>
          </div>

          {/* Posts Feed Grid */}
          {isLoading && filteredPosts.length === 0 ? (
            <div className="glass-card" style={{ padding: '60px', textAlign: 'center' }}>
              <div className="pulse-dot" style={{ margin: '0 auto 12px auto' }}></div>
              <span style={{ color: 'var(--text-secondary)' }}>Loading feed updates...</span>
            </div>
          ) : filteredPosts.length === 0 ? (
            <div className="glass-card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '14px' }}>
              No discussions found matching this filter.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {filteredPosts.map((post) => (
                <div key={post.id} className="glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {/* Header Author Info */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        background: 'rgba(168, 85, 247, 0.1)',
                        border: '1px solid rgba(168, 85, 247, 0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        color: 'var(--accent-purple)',
                      }}>
                        {post.author[0]?.toUpperCase() || '?'}
                      </div>
                      <strong style={{ color: 'var(--accent-purple)', fontSize: '14px' }}>{post.author}</strong>
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)', marginLeft: '8px' }}>
                        {new Date(post.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} -{' '}
                        {new Date(post.createdAt).toLocaleDateString()}
                      </span>
                    </div>

                    {post.author === activeUser && (
                      <button
                        onClick={() => handleDeletePost(post.id!)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--status-failed)',
                          cursor: 'pointer',
                          padding: '4px',
                          borderRadius: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                        title="Delete Post"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>

                  {/* Content */}
                  <p style={{ fontSize: '14px', color: 'var(--text-primary)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                    {post.content}
                  </p>

                  {/* Tags */}
                  {post.tags && (
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {post.tags.split(/\s+/).map((tag, idx) => (
                        <span
                          key={idx}
                          style={{
                            fontSize: '11px',
                            color: 'var(--accent-purple)',
                            background: 'rgba(168, 85, 247, 0.08)',
                            padding: '2px 8px',
                            borderRadius: '4px',
                          }}
                        >
                          #{tag.replace('#', '')}
                        </span>
                      ))}
                    </div>
                  )}

                  <hr style={{ border: 'none', borderBottom: '1px solid var(--border-color)', margin: '4px 0' }} />

                  {/* Like / Interactions */}
                  <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                    <button
                      onClick={() => handleLikePost(post.id!)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: (post.id && likedPosts.has(post.id)) ? 'var(--status-failed)' : 'var(--text-secondary)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '13px',
                        padding: 0,
                      }}
                    >
                      <Heart size={14} fill={(post.id && likedPosts.has(post.id)) ? 'var(--status-failed)' : 'none'} />
                      <span>{post.likes} Likes</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default Hub;
