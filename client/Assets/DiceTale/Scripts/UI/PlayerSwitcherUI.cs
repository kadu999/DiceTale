using System.Collections.Generic;
using System.Text;
using UnityEngine;
using UnityEngine.UI;

namespace DiceTale
{
    /// <summary>
    /// 玩家信息面板（挂在 Resources/PlayerPanel 预制体根节点上，由 Game 实例化加载）：
    /// 左侧 240px 宽、满高，从上到下 4 等分格子，每格显示玩家名字与拥有的道具；
    /// 点击格子切换当前玩家，当前玩家格子边缘描边高亮（背景不变色）。
    ///
    /// 美化：
    /// - 每格做成卡片（四周留缝，面板底色透出作为分隔）；
    /// - 格子左侧一条玩家区分色条（与地图精灵颜色一致）；
    /// - 名字用玩家区分色，道具浅灰并带「·」前缀逐行显示。
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

        [SerializeField, Tooltip("当前玩家格子边缘高亮色（描边，不再整格变色）")]
        private Color m_CurrentColor = new Color(0.85f, 0.7f, 0.15f, 0.75f);

        [SerializeField, Tooltip("当前玩家格子描边宽度（px）")]
        private float m_CurrentBorderWidth = 2.5f;

        [SerializeField, Tooltip("空格子背景色（玩家不足时）")]
        private Color m_EmptyColor = new Color(0f, 0f, 0f, 0.2f);

        [SerializeField, Tooltip("道具文字颜色")]
        private Color m_ItemsColor = new Color(0.82f, 0.85f, 0.88f, 1f);

        [SerializeField, Tooltip("格子四周留缝（px，透出面板底色形成分隔）")]
        private Vector2 m_SlotInset = new Vector2(4f, 2f);

        [SerializeField, Tooltip("左侧玩家区分色条宽度（px）")]
        private float m_AccentWidth = 6f;

        private readonly List<RectTransform> slots = new List<RectTransform>();
        private readonly List<Text> nameTexts = new List<Text>();
        private readonly List<Text> itemTexts = new List<Text>();
        private readonly List<Image> accents = new List<Image>();
        private readonly List<Image[]> borderStrips = new List<Image[]>();
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

        /// <summary>按预制体约定查找并绑定格子（PlayerSlot_i / Name / Items），套用卡片留缝、色条与点击。</summary>
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

                var rt = slot.GetComponent<RectTransform>();
                // 卡片留缝：四周向内收，面板底色透出形成分隔线
                rt.offsetMin = new Vector2(m_SlotInset.x, m_SlotInset.y);
                rt.offsetMax = new Vector2(-m_SlotInset.x, -m_SlotInset.y);

                // 当前玩家边缘描边条：4 条实心色条（上下左右），仅当前玩家时启用，不参与背景叠色
                var strips = CreateBorderStrips(slot);

                // 左侧玩家区分色条（纯装饰，不拦截点击），渲染在描边条之上、文字之下
                var accent = CreateAccentBar(slot);
                accent.transform.SetSiblingIndex(4);

                slots.Add(rt);
                nameTexts.Add(nameText.GetComponent<Text>());
                itemTexts.Add(itemText.GetComponent<Text>());
                accents.Add(accent);
                borderStrips.Add(strips);
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

        /// <summary>创建格子左侧的玩家区分色条。</summary>
        private Image CreateAccentBar(Transform slot)
        {
            var go = new GameObject("Accent", typeof(RectTransform), typeof(Image));
            go.transform.SetParent(slot, false);

            var rt = go.GetComponent<RectTransform>();
            rt.anchorMin = new Vector2(0f, 0f);
            rt.anchorMax = new Vector2(0f, 1f);
            rt.pivot = new Vector2(0f, 0.5f);
            rt.sizeDelta = new Vector2(m_AccentWidth, 0f);
            rt.anchoredPosition = Vector2.zero;

            var image = go.GetComponent<Image>();
            image.color = Color.clear;
            image.raycastTarget = false;
            return image;
        }

        /// <summary>创建当前玩家边缘描边条：上下左右 4 条实心色条（内贴格子边缘），默认关闭。</summary>
        private Image[] CreateBorderStrips(Transform slot)
        {
            float b = m_CurrentBorderWidth;
            var strips = new Image[4];
            strips[0] = CreateBorderStrip(slot, "BorderTop", new Vector2(0f, 1f), new Vector2(1f, 1f), new Vector2(0.5f, 1f), new Vector2(0f, b));
            strips[1] = CreateBorderStrip(slot, "BorderBottom", new Vector2(0f, 0f), new Vector2(1f, 0f), new Vector2(0.5f, 0f), new Vector2(0f, b));
            strips[2] = CreateBorderStrip(slot, "BorderLeft", new Vector2(0f, 0f), new Vector2(0f, 1f), new Vector2(0f, 0.5f), new Vector2(b, 0f));
            strips[3] = CreateBorderStrip(slot, "BorderRight", new Vector2(1f, 0f), new Vector2(1f, 1f), new Vector2(1f, 0.5f), new Vector2(b, 0f));
            return strips;
        }

        /// <summary>创建单条描边色条：锚在格子边缘线上、向内侧延伸，渲染在文字之下。</summary>
        private Image CreateBorderStrip(Transform slot, string name,
            Vector2 anchorMin, Vector2 anchorMax, Vector2 pivot, Vector2 size)
        {
            var go = new GameObject(name, typeof(RectTransform), typeof(Image));
            go.transform.SetParent(slot, false);
            go.transform.SetSiblingIndex(0); // 依次插到最底：4 条描边在文字/色条之下

            var rt = go.GetComponent<RectTransform>();
            rt.anchorMin = anchorMin;
            rt.anchorMax = anchorMax;
            rt.pivot = pivot;
            rt.anchoredPosition = Vector2.zero;
            rt.sizeDelta = size;

            var image = go.GetComponent<Image>();
            image.color = m_CurrentColor;
            image.raycastTarget = false;
            image.enabled = false; // 仅当前玩家时启用
            return image;
        }

        /// <summary>按当前玩家列表重填所有格子的名字/道具/颜色。</summary>
        private void RefreshSlots()
        {
            var manager = CharacterManager.Instance;
            lastPlayerCount = manager != null ? manager.Players.Count : 0;
            lastCurrentIndex = manager != null ? manager.CurrentPlayerIndex : 0;

            for (int i = 0; i < slots.Count; i++)
            {
                var player = manager != null && i < manager.Players.Count ? manager.Players[i] : null;

                // 名字：玩家区分色（与地图精灵一致）；显示名取主体枢纽
                nameTexts[i].text = player != null ? player.DisplayName : string.Empty;
                nameTexts[i].color = player != null ? CharacterManager.GetPlayerColor(i) : Color.white;

                var itemsText = player != null ? BuildItemsText(player) : string.Empty;
                itemTexts[i].text = itemsText;
                itemTexts[i].color = m_ItemsColor;
                cachedItemStrings[i] = itemsText;
            }

            RefreshHighlight();
        }

        /// <summary>刷新格子背景、当前玩家边缘描边条、色条与可用状态（空格子变暗且不拦截点击）。</summary>
        private void RefreshHighlight()
        {
            var manager = CharacterManager.Instance;
            for (int i = 0; i < slots.Count; i++)
            {
                var isEmpty = manager == null || i >= manager.Players.Count;
                var isCurrent = !isEmpty && i == manager.CurrentPlayerIndex;
                var image = slots[i].GetComponent<Image>();
                var button = slots[i].GetComponent<Button>();
                button.interactable = !isEmpty;
                image.raycastTarget = !isEmpty;
                image.color = isEmpty ? m_EmptyColor : m_NormalColor;

                // 仅当前玩家显示边缘描边条（背景保持普通色，不整格变色）
                foreach (var strip in borderStrips[i])
                {
                    strip.enabled = isCurrent;
                }

                accents[i].color = isEmpty ? Color.clear : CharacterManager.GetPlayerColor(i);
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

        /// <summary>玩家主体的道具：按道具名分组，同名合并为「道具名 ×数量」，逐行「· 」前缀显示。</summary>
        private static string BuildItemsText(BackendObject player)
        {
            var backpack = player != null ? player.GetComponent<Backpack>() : null;
            var items = backpack != null ? backpack.Items : null;
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
                sb.Append("· ").Append(pair.Key);
                if (pair.Value > 1)
                {
                    sb.Append(" ×").Append(pair.Value);
                }
            }

            return sb.ToString();
        }
    }
}
