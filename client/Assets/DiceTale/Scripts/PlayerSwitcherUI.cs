using System.Collections.Generic;
using System.Text;
using UnityEngine;
using UnityEngine.UI;

namespace DiceTale
{
    /// <summary>
    /// 玩家信息面板（挂在 Resources/PlayerPanel 预制体根节点上，由 Game 实例化加载）：
    /// 左侧 240px 宽、满高，从上到下 4 等分格子，每格显示玩家名字与拥有的道具；
    /// 点击格子切换当前玩家，当前玩家高亮。玩家数量变化重填，当前玩家/道具变化刷新。
    ///
    /// 预制体结构约定（绑定按名字查找）：
    ///   PlayerPanel
    ///   ├── PlayerSlot_0 .. PlayerSlot_{MaxPlayers-1}（RectTransform + Image + Button）
    ///   │   ├── Name   （Text：玩家名字）
    ///   │   └── Items  （Text：拥有的道具）
    /// </summary>
    public class PlayerSwitcherUI : MonoBehaviour
    {
        [SerializeField, Tooltip("最大显示玩家数（对应预制体里的格子数）")]
        private int m_MaxPlayers = 4;

        [SerializeField, Tooltip("面板背景色（应用到根 Image）")]
        private Color m_PanelColor = new Color(0.08f, 0.08f, 0.1f, 0.6f);

        [SerializeField, Tooltip("普通格子背景色")]
        private Color m_NormalColor = new Color(0f, 0f, 0f, 0.45f);

        [SerializeField, Tooltip("当前玩家格子高亮色")]
        private Color m_CurrentColor = new Color(0.85f, 0.7f, 0.15f, 0.75f);

        [SerializeField, Tooltip("空格子背景色（玩家不足时）")]
        private Color m_EmptyColor = new Color(0f, 0f, 0f, 0.2f);

        private readonly List<RectTransform> slots = new List<RectTransform>();
        private readonly List<Text> nameTexts = new List<Text>();
        private readonly List<Text> itemTexts = new List<Text>();
        private readonly List<string> cachedItemStrings = new List<string>();
        private int lastPlayerCount = -1;
        private int lastCurrentIndex = -1;
        private bool bound;

        private void Start()
        {
            BindSlots();
        }

        private void Update()
        {
            if (!bound)
            {
                return;
            }

            var manager = CharacterManager.Instance;
            if (manager == null)
            {
                return;
            }

            // 玩家数量变化：重填所有格子
            if (manager.Players.Count != lastPlayerCount)
            {
                RefreshSlots();
            }

            // 当前玩家变化：刷新高亮
            if (manager.CurrentPlayerIndex != lastCurrentIndex)
            {
                lastCurrentIndex = manager.CurrentPlayerIndex;
                RefreshHighlight();
            }

            // 道具变化：仅比较文本串，避免每帧重建
            RefreshItemsIfChanged(manager);
        }

        /// <summary>按预制体约定查找并绑定格子（PlayerSlot_i / Name / Items），绑定按钮点击与面板背景色。</summary>
        private void BindSlots()
        {
            var rootImage = GetComponent<Image>();
            if (rootImage != null)
            {
                rootImage.color = m_PanelColor;
            }

            for (int i = 0; i < m_MaxPlayers; i++)
            {
                var slot = transform.Find($"PlayerSlot_{i}");
                if (slot == null)
                {
                    Debug.LogWarning($"[PlayerSwitcherUI] PlayerSlot_{i} not found in prefab, stop binding.");
                    break;
                }

                var nameText = slot.Find("Name");
                var itemText = slot.Find("Items");
                if (nameText == null || itemText == null)
                {
                    Debug.LogWarning($"[PlayerSwitcherUI] PlayerSlot_{i} missing Name/Items child, stop binding.");
                    break;
                }

                slots.Add(slot.GetComponent<RectTransform>());
                nameTexts.Add(nameText.GetComponent<Text>());
                itemTexts.Add(itemText.GetComponent<Text>());
                cachedItemStrings.Add(string.Empty);

                // 点击格子切换当前玩家
                var button = slot.GetComponent<Button>();
                int capturedIndex = i;
                button.onClick.AddListener(() =>
                {
                    var mgr = CharacterManager.Instance;
                    if (mgr != null && capturedIndex < mgr.Players.Count)
                    {
                        mgr.SetCurrentPlayer(capturedIndex);
                    }
                });
            }

            bound = slots.Count > 0;
            if (!bound)
            {
                Debug.LogWarning("[PlayerSwitcherUI] No slots bound, player panel disabled.");
                return;
            }

            RefreshSlots();
            RefreshHighlight();
        }

        /// <summary>按当前玩家列表重填所有格子的名字/道具/可用状态。</summary>
        private void RefreshSlots()
        {
            var manager = CharacterManager.Instance;
            lastPlayerCount = manager != null ? manager.Players.Count : 0;
            lastCurrentIndex = manager != null ? manager.CurrentPlayerIndex : 0;

            for (int i = 0; i < slots.Count; i++)
            {
                var player = manager != null && i < manager.Players.Count ? manager.Players[i] : null;
                nameTexts[i].text = player != null ? player.DisplayName : string.Empty;

                var itemsText = player != null ? BuildItemsText(player) : string.Empty;
                itemTexts[i].text = itemsText;
                cachedItemStrings[i] = itemsText;
            }

            RefreshHighlight();
        }

        /// <summary>刷新格子背景高亮与可用状态（空格子变暗且不拦截点击）。</summary>
        private void RefreshHighlight()
        {
            var manager = CharacterManager.Instance;
            for (int i = 0; i < slots.Count; i++)
            {
                var isEmpty = manager == null || i >= manager.Players.Count;
                var image = slots[i].GetComponent<Image>();
                var button = slots[i].GetComponent<Button>();
                button.interactable = !isEmpty;
                image.raycastTarget = !isEmpty;
                image.color = isEmpty
                    ? m_EmptyColor
                    : (i == manager.CurrentPlayerIndex ? m_CurrentColor : m_NormalColor);
            }
        }

        /// <summary>道具列表变化时刷新道具文本（与缓存串比较，避免每帧重建）。</summary>
        private void RefreshItemsIfChanged(CharacterManager manager)
        {
            for (int i = 0; i < slots.Count; i++)
            {
                var player = manager != null && i < manager.Players.Count ? manager.Players[i] : null;
                var text = player != null ? BuildItemsText(player) : string.Empty;
                if (text != cachedItemStrings[i])
                {
                    itemTexts[i].text = text;
                    cachedItemStrings[i] = text;
                }
            }
        }

        /// <summary>玩家拥有的道具：按道具名分组，同名合并为「道具名 ×数量」，逐行显示。</summary>
        private static string BuildItemsText(Player player)
        {
            var items = player.Items;
            if (items == null || items.Count == 0)
            {
                return string.Empty;
            }

            var counts = new Dictionary<string, int>();
            foreach (var item in items)
            {
                if (string.IsNullOrEmpty(item))
                {
                    continue;
                }

                counts.TryGetValue(item, out int count);
                counts[item] = count + 1;
            }

            if (counts.Count == 0)
            {
                return string.Empty;
            }

            var sb = new StringBuilder();
            bool first = true;
            foreach (var pair in counts)
            {
                if (!first)
                {
                    sb.Append('\n');
                }

                first = false;
                sb.Append(pair.Key);
                if (pair.Value > 1)
                {
                    sb.Append(" ×").Append(pair.Value);
                }
            }

            return sb.ToString();
        }
    }
}
