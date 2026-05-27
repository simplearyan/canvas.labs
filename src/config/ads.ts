export interface BrandPromoAdConfig {
  brandName: string;
  promoText: string;
  buttonText: string;
  upgradeUrl: string;
  gradientFrom: string;
  gradientTo: string;
  enabled: boolean;
}

export interface AdSenseConfig {
  clientId: string;
  slotId: string;
  scriptUrl: string;
}

export interface AdConfig {
  adsense: AdSenseConfig;
  brandPromo: BrandPromoAdConfig;
}

export const AD_CONFIG: AdConfig = {
  adsense: {
    clientId: "ca-pub-7993314093599705",
    slotId: "9342323532",
    scriptUrl: "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js",
  },
  brandPromo: {
    brandName: "Canvas Labs Pro",
    promoText: "Unlock 4K exports, priority GPU, and all presets!",
    buttonText: "Upgrade",
    upgradeUrl: "/editor/typography-studio",
    gradientFrom: "from-brand-500",
    gradientTo: "to-amber-400",
    enabled: false,
  }
};
