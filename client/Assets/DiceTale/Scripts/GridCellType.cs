namespace DiceTale
{
    /// <summary>
    /// 格子类型。掩码：0=空 1=障碍 2=困难 4=水 8~128=雾1~雾5（浓度递增）。
    /// </summary>
    public enum GridCellType
    {
        Empty = 0,
        Obstacle = 1,
        Difficult = 2,
        Water = 3,
        Fog1 = 4,
        Fog2 = 5,
        Fog3 = 6,
        Fog4 = 7,
        Fog5 = 8,
    }
}
