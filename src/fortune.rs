use sha2::{Sha256, Digest};
use chrono::{Utc, FixedOffset};

#[derive(Debug, Clone)]
pub struct FortuneDef {
    pub val: &'static str,
    pub label: &'static str,
    pub threshold: u32,
}

pub const FORTUNES: &[FortuneDef] = &[
    FortuneDef { val: "daikichi", label: "大吉", threshold: 6 },   // 6%
    FortuneDef { val: "kichi", label: "吉", threshold: 28 },     // 22%
    FortuneDef { val: "chukichi", label: "中吉", threshold: 50 },  // 22%
    FortuneDef { val: "shokichi", label: "小吉", threshold: 70 },  // 20%
    FortuneDef { val: "suekichi", label: "末吉", threshold: 88 },  // 18%
    FortuneDef { val: "kyo", label: "凶", threshold: 97 },       // 9%
    FortuneDef { val: "daikyo", label: "大凶", threshold: 100 },   // 3%
];

pub fn get_daily_fortune(did: &str) -> &'static str {
    let jst_offset = FixedOffset::east_opt(9 * 3600).unwrap();
    let now_jst = Utc::now().with_timezone(&jst_offset);
    let date_str = now_jst.format("%Y-%m-%d").to_string();

    calculate_fortune(did, &date_str)
}

pub fn calculate_fortune(did: &str, date_str: &str) -> &'static str {
    let seed = format!("{}{}", did, date_str);

    let mut hasher = Sha256::new();
    hasher.update(seed.as_bytes());
    let hash = hasher.finalize();

    // Read first 4 bytes as u32be
    let hash_val = u32::from_be_bytes(hash[0..4].try_into().unwrap());
    let val = hash_val % 100;

    for fortune in FORTUNES {
        if val < fortune.threshold {
            return fortune.val;
        }
    }
    "kichi"
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_fortune_consistency() {
        let date = "2026-01-28";

        assert_eq!(calculate_fortune("did:plc:ragtjsm2j2vknwkz3zp4oxrd", date), "daikichi");
        assert_eq!(calculate_fortune("did:plc:e7w52g22jjgr5g7y6j6y6", date), "daikichi");
        assert_eq!(calculate_fortune("did:plc:test1234", date), "chukichi");
    }
}
