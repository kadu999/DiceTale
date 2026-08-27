using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;

namespace DiceTale
{
    /// <summary>
    /// 玩家切换 UI：在场景 Canvas 上为每个玩家生成一个切换按钮（模拟多玩家），
    /// 点击切换当前玩家（<see cref="CharacterManager.SetCurrentPlayer"/>），当前玩家高亮。
    /// 玩家数量或当前玩家变化时自动重建/刷新高亮。
    /// </summary>
    public class PlayerSwitcherUI : MonoBehaviour
    {
        [SerializeField, Tooltip("按钮行起点（相对屏幕左下角的偏移）")]
        private Vector2 anchor = new Vector2(20f, 20f);

        [SerializeField, Tooltip("每个按钮的尺寸")]
        private Vector2 buttonSize = new Vector2(140f, 52f);

        [SerializeField, Tooltip("按钮间距")]
        private float spacing = 12f;

        [SerializeField, Tooltip("普通按钮颜色")]
        private Color normalColor = new Color(1f, 1f, 1f, 0.9f);

        [SerializeField, Tooltip("当前玩家按钮高亮颜色")]
        private Color currentColor = new Color(1f, 0.85f, 0.2f, 1f);

        private Canvas canvas;
        private readonly List<Button> buttons = new List<Button>();
        private int lastPlayerCount = -1;
        private int lastCurrentIndex = -1;

        private void Start()
        {
            canvas = Object.FindFirstObjectByType<Canvas>();
            if (canvas == null)
            {
                Debug.LogWarning("[PlayerSwitcherUI] Canvas not found in scene, player switch buttons disabled.");
                return;
            }

            Refresh();
        }

        private void Update()
        {
            var manager = CharacterManager.Instance;
            if (manager == null || canvas == null)
            {
                return;
            }

            // 玩家数量或当前玩家变化时刷新
            if (manager.Players.Count != lastPlayerCount || manager.CurrentPlayerIndex != lastCurrentIndex)
            {
                Refresh();
            }
        }

        private void Refresh()
        {
            var manager = CharacterManager.Instance;
            if (manager == null || canvas == null)
            {
                return;
            }

            // 玩家数量变化时重建按钮
            if (manager.Players.Count != lastPlayerCount)
            {
                Rebuild(manager);
            }

            lastPlayerCount = manager.Players.Count;
            lastCurrentIndex = manager.CurrentPlayerIndex;

            // 刷新高亮
            for (int i = 0; i < buttons.Count; i++)
            {
                if (buttons[i] != null)
                {
                    buttons[i].image.color = i == manager.CurrentPlayerIndex ? currentColor : normalColor;
                }
            }
        }

        private void Rebuild(CharacterManager manager)
        {
            foreach (var button in buttons)
            {
                if (button != null)
                {
                    Destroy(button.gameObject);
                }
            }

            buttons.Clear();

            for (int i = 0; i < manager.Players.Count; i++)
            {
                CreateButton(i, manager.Players[i]);
            }
        }

        private void CreateButton(int index, Player player)
        {
            var go = new GameObject($"PlayerBtn_{index}", typeof(RectTransform), typeof(Image), typeof(Button));
            go.transform.SetParent(canvas.transform, false);

            var rt = go.GetComponent<RectTransform>();
            rt.anchorMin = new Vector2(0f, 0f); // 屏幕左下角
            rt.anchorMax = new Vector2(0f, 0f);
            rt.pivot = new Vector2(0f, 0.5f);
            rt.sizeDelta = buttonSize;
            rt.anchoredPosition = new Vector2(anchor.x + index * (buttonSize.x + spacing), anchor.y);

            var image = go.GetComponent<Image>();
            image.color = normalColor;

            var button = go.GetComponent<Button>();
            button.targetGraphic = image;
            int capturedIndex = index;
            button.onClick.AddListener(() =>
            {
                var mgr = CharacterManager.Instance;
                if (mgr != null)
                {
                    mgr.SetCurrentPlayer(capturedIndex);
                    Refresh();
                }
            });

            var textGo = new GameObject("Label", typeof(RectTransform), typeof(Text));
            textGo.transform.SetParent(go.transform, false);
            var textRt = textGo.GetComponent<RectTransform>();
            textRt.anchorMin = Vector2.zero;
            textRt.anchorMax = Vector2.one;
            textRt.offsetMin = Vector2.zero;
            textRt.offsetMax = Vector2.zero;

            var label = textGo.GetComponent<Text>();
            label.text = player != null ? player.PlayerId : $"玩家{index + 1}";
            label.alignment = TextAnchor.MiddleCenter;
            label.fontSize = 20;
            label.color = Color.black;
            label.font = GetBuiltinFont();

            buttons.Add(button);
        }

        private static Font GetBuiltinFont()
        {
            var font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
            if (font == null)
            {
                font = Resources.GetBuiltinResource<Font>("Arial.ttf");
            }

            return font;
        }
    }
}
