using UnityEngine;

namespace DiceTale
{
    public class PlayerMover : MonoBehaviour
    {
        [SerializeField]
        private float moveSpeed = 5f;

        private Vector3 targetPosition;
        private bool isMoving;

        public void MoveTo(Vector3 position)
        {
            targetPosition = position;
            targetPosition.z = transform.position.z;
            isMoving = true;
        }

        public void Stop()
        {
            isMoving = false;
        }

        private void Update()
        {
            if (!isMoving)
            {
                return;
            }

            transform.position = Vector3.MoveTowards(transform.position, targetPosition, moveSpeed * Time.deltaTime);

            if (Vector3.Distance(transform.position, targetPosition) < 0.01f)
            {
                transform.position = targetPosition;
                isMoving = false;
            }
        }
    }
}
