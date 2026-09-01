using System.Collections;
using UnityEngine;
using UnityEngine.Video;

namespace DiceTale
{
    /// <summary>
    /// 智能视频播放器：运行时直接创建 VideoPlayer，支持多 clip 按索引播放。
    /// PlayWithFade：切换时先把当前帧冻结到 RenderTexture，把目标 quad 换成
    /// DiceTale/VideoFade 交叉淡化材质（_FromTex=冻结帧, _ToTex=新视频渲染目标），
    /// _Alpha 0→1 平滑过渡。Play 保持原行为；淡化只在 PlayWithFade 中生效。
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

        [SerializeField, Tooltip("PlayWithFade 交叉淡化时长（秒）")]
        private float _fadeDuration = 0.5f;

        private VideoPlayer _videoPlayer;

        private int _currentIndex;

        private float _playbackSpeed = 1f;

        // 目标原本的材质（淡化结束要换回来）
        private Material _targetMaterial;

        // ---- 交叉淡化 ----
        private Material _fadeMaterial;   // DiceTale/VideoFade（_FromTex/_ToTex/_Alpha）
        private RenderTexture _frozenRT;  // 上一视频最后一帧
        private bool _fading;             // 淡化进行中
        private Coroutine _fadeRoutine;

        // 准备中
        private bool _isPrepared = false;


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

            // 播放前先显示占位图（缓存目标材质实例，淡化结束要恢复它）
            _targetMaterial = _target.material;
            _targetMaterial.SetTexture("_MainTex", _placeholderTexture);

            _isPrepared = false;
            _videoPlayer.playOnAwake = false;
            _videoPlayer.audioOutputMode = VideoAudioOutputMode.None;
            _videoPlayer.renderMode = VideoRenderMode.MaterialOverride;
            _videoPlayer.targetMaterialRenderer = _target;
            _videoPlayer.targetMaterialProperty = "_MainTex";
            _videoPlayer.waitForFirstFrame = true;
            _videoPlayer.prepareCompleted += OnVideoPrepared;

            // 交叉淡化材质
            Shader shader = Shader.Find("DiceTale/VideoFade");
            if (shader == null)
            {
                shader = Resources.Load<Shader>("Shaders/VideoFade");
            }

            if (shader != null)
            {
                _fadeMaterial = new Material(shader);
            }

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

        private void OnDestroy()
        {
            if (_fadeRoutine != null)
            {
                StopCoroutine(_fadeRoutine);
            }

            RestoreAfterFade();

            if (_frozenRT != null)
            {
                _frozenRT.Release();
            }

            if (_fadeMaterial != null)
            {
                Destroy(_fadeMaterial);
            }
        }

        void OnVideoPrepared(VideoPlayer vp)
        {
            _isPrepared = true;
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
        /// 带交叉淡化地播放指定 clip：冻结当前帧，切换新视频后 _Alpha 0→1 平滑过渡。
        /// duration &lt;= 0 时使用 Inspector 中的 _fadeDuration。
        /// </summary>
        public void PlayWithFade(int index, bool loop = true, float speed = 1f, float duration = -1f)
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

            // 打断上一次未完成的过渡，并还原渲染模式/材质
            if (_fadeRoutine != null)
            {
                StopCoroutine(_fadeRoutine);
                _fadeRoutine = null;
                RestoreAfterFade();
            }

            float d = duration > 0f ? duration : _fadeDuration;

            // 只有当前正在播放时才冻结得到"上一帧"；否则与 Play 行为一致，直接切换
            if (d > 0f && _videoPlayer.isPlaying && _videoPlayer.isPrepared)
            {
                _fadeRoutine = StartCoroutine(CrossFadeCoroutine(d));
            }
            else
            {
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
        }

        /// <summary>
        /// 停止播放（同时取消进行中的交叉淡化并还原状态）
        /// </summary>
        public void Stop()
        {
            if (_fadeRoutine != null)
            {
                StopCoroutine(_fadeRoutine);
                _fadeRoutine = null;
            }

            RestoreAfterFade();

            if (_videoPlayer != null)
            {
                _videoPlayer.Stop();
            }
        }

        // ---------------- 交叉淡化实现 ----------------

        private IEnumerator CrossFadeCoroutine(float duration)
        {
            // 1) 取当前帧（播放器实时纹理），冻结 + 准备新视频渲染目标
            Texture source = _videoPlayer.texture;
            if (source == null || _fadeMaterial == null || _target == null)
            {
                _fadeRoutine = null;
                yield break;
            }

            EnsureRTs(source);

            _videoPlayer.Pause(); // 定住画面，保证拷贝的正是"停止前那一帧"

            Graphics.Blit(source, _frozenRT); // 冻结帧

            _fadeMaterial.SetTexture("_FromTex", _frozenRT);
            _fadeMaterial.SetTexture("_MainTex", source);
            _fadeMaterial.SetFloat("_Alpha", 0f);
            _target.material = _fadeMaterial;
            _fading = true;

            yield return null; // 等一帧，确保 GPU 拷贝完成

            // 2) 切换：新视频渲染进 _videoRT
            ApplyClip(_currentIndex);
            _isPrepared = false;

            if (_videoPlayer.isPrepared)
            {
                _isPrepared = true;
                _videoPlayer.Play();
            }
            else
            {
                _videoPlayer.Prepare();
            }

            // 3) 等新视频真正解码出第一帧（isPlaying 会提前置真，帧数据可能还没出来）
            float wait = 0f;
            while (wait < 5f && !_isPrepared)
            {
                wait += Time.unscaledDeltaTime;
                yield return null;
            }

            yield return null; // 再让一帧，确保第一帧已写入 RT

            // 4) 交叉淡化：_Alpha 0 -> 1
            float t = 0f;
            while (t < duration)
            {
                t += Time.unscaledDeltaTime;
                _fadeMaterial.SetFloat("_Alpha", Mathf.Clamp01(t / duration));
                yield return null;
            }

            _fadeMaterial.SetFloat("_Alpha", 1f);

            // 5) 还原
            RestoreAfterFade();
            _fadeRoutine = null;
        }

        /// <summary>
        /// 保证两块 RT 存在且与当前视频同尺寸（跨淡化复用，不反复分配）
        /// </summary>
        private void EnsureRTs(Texture source)
        {
            if (_frozenRT != null && _frozenRT.width == source.width && _frozenRT.height == source.height)
            {
                return;
            }

            if (_frozenRT != null)
            {
                _frozenRT.Release();
            }

            _frozenRT = new RenderTexture(source.width, source.height, 0, RenderTextureFormat.ARGB32);
        }

        /// <summary>
        /// 淡化结束/被中断时：视频回到 MaterialOverride、目标换回原材质
        /// </summary>
        private void RestoreAfterFade()
        {
            if (_fading && _target != null && _targetMaterial != null)
            {
                // 先让目标显示新视频的最后一帧，避免换回原材质时闪一下旧帧
                if (_videoPlayer != null && _videoPlayer.texture)
                {
                    _targetMaterial.SetTexture("_MainTex", _videoPlayer.texture);
                }
                _target.material = _targetMaterial;
                _fading = false;
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
