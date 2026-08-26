using System;

namespace DiceTale
{
    public interface IBackendService
    {
        void RequestDoorAccess(string doorId, Action<bool> callback);
    }
}
