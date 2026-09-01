using DiceTale;
using UnityEngine;
using static UnityEngine.GraphicsBuffer;

namespace DiceTale
{
    public class PlayAudioAction : ConditionalBackendChangeAction
    {

        public override void OnComponentChanged(BackendComponent component)
        {
            if (ConditionMet(component))
            {

            }
        }
    }
}