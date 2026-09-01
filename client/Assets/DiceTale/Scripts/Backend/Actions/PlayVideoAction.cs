using DiceTale;
using UnityEngine;

namespace DiceTale
{
    public class PlayVideoAction : ConditionalBackendChangeAction
    {
        [SerializeField]
        private SmartVideoPlayer _videoPlayer;

        [SerializeField]
        private int _index;

        [SerializeField]
        private bool _isLooping;

        [SerializeField]
        private float _speed = 1.0f;

        public override void OnComponentChanged(BackendComponent component)
        {
            if (ConditionMet(component))
            {
                _videoPlayer.Play(_index, _isLooping, _speed);
            }
        }
    }
}

