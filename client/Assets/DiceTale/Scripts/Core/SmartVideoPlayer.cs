using UnityEngine;
using UnityEngine.Video;

namespace DiceTale
{
    /// <summary>
    /// 智能视频播放器：运行时直接创建 VideoPlayer 组件，无需在场景中预先挂载。
    /// 支持多个 VideoClip，可按索引播放。
    /// </summary>
    public class SmartVideoPlayer : MonoBehaviour
    {
        [SerializeField]
        private Texture _placeholderTexture; // 静态占位图

        [SerializeField]
        private Renderer _target;

        [SerializeField]
        private bool _playOnAwake;

        [SerializeField]
        private bool _isLooping;

        [SerializeField]
        private VideoClip[] _videoClips; // 多个视频剪辑

        [SerializeField]
        private int _startIndex; // 默认从第几个 clip 开始播放

        private VideoPlayer _videoPlayer;

        private int _currentIndex;

        private float _playbackSpeed = 1f;

        void Awake()
        {
            // 直接创建 VideoPlayer，不再引用场景中已有的组件
            _videoPlayer = gameObject.AddComponent<VideoPlayer>();

            if (_target == null)
            {
                _target = GetComponent<Renderer>();
            }

            if (_target == null)
            {
                return;
            }

            // 播放前先显示占位图
            _target.material.SetTexture("_MainTex", _placeholderTexture);

            _videoPlayer.playOnAwake = false;
            _videoPlayer.audioOutputMode = VideoAudioOutputMode.None;
            _videoPlayer.renderMode = VideoRenderMode.MaterialOverride;
            _videoPlayer.targetMaterialRenderer = _target;
            _videoPlayer.targetMaterialProperty = "_MainTex";
            _videoPlayer.prepareCompleted += OnVideoPrepared;

            if (_videoClips != null && _videoClips.Length > 0)
            {
                _currentIndex = Mathf.Clamp(_startIndex, 0, _videoClips.Length - 1);
                ApplyClip(_currentIndex);
            }
        }

        private void OnEnable()
        {
            if (_playOnAwake && _videoPlayer != null)
            {
                _videoPlayer.Prepare();
            }
        }

        void OnVideoPrepared(VideoPlayer vp)
        {
            _videoPlayer.Play();
        }

        /// <summary>
        /// 播放当前 clip
        /// </summary>
        public void Play()
        {
            Play(_currentIndex);
        }

        /// <summary>
        /// 按索引播放指定的 clip
        /// </summary>
        public void Play(int index, bool loop = true, float speed = 1f)
        {
            if (_videoPlayer == null || _videoClips == null || index < 0 || index >= _videoClips.Length)
            {
                return;
            }

            if (_videoClips[index] == null)
            {
                return;
            }

            _isLooping = loop;
            _playbackSpeed = speed;
            _currentIndex = index;
            ApplyClip(_currentIndex);

            if (_videoPlayer.isPrepared)
            {
                _videoPlayer.Play();
            }
            else
            {
                _videoPlayer.Prepare();
            }
        }

        /// <summary>
        /// 停止播放
        /// </summary>
        public void Stop()
        {
            if (_videoPlayer != null)
            {
                _videoPlayer.Stop();
            }
        }

        private void ApplyClip(int index)
        {
            _videoPlayer.Stop();
            _videoPlayer.clip = _videoClips[index];
            _videoPlayer.isLooping = _isLooping;
            _videoPlayer.playbackSpeed = _playbackSpeed;
        }
    }
}
