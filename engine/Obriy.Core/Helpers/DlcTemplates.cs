namespace Obriy.Core.Helpers
{
    public static class DlcTemplates
    {
        // Setup2Xml: Групи є, але вони порожні. GameConfigService наповнить їх автоматично.
        public static string Setup2Xml => @"<?xml version=""1.0"" encoding=""UTF-8""?>
<SSetupData>
    <deviceName>dlc_patchDay18NG</deviceName>
    <datFile>content.xml</datFile>
    <timeStamp>20/3/2018 12:00:00</timeStamp>
    <nameHash>PATCHDAY18NG</nameHash>
    <contentChangeSets />
    <contentChangeSetGroups>
        <Item>
            <NameHash>GROUP_EARLY_ON</NameHash>
            <ContentChangeSets>
                <Item>CCS_PATCHDAY18_NG_INIT</Item>
            </ContentChangeSets>
        </Item>
        <Item>
            <NameHash>GROUP_STARTUP</NameHash>
            <ContentChangeSets>
                <Item>CCS_PATCHDAY18_NG_INIT</Item>
            </ContentChangeSets>
        </Item>
        <Item>
            <NameHash>GROUP_UPDATE_STREAMING</NameHash>
            <ContentChangeSets>
                <Item>CCS_PATCHDAY18_NG_STREAMING</Item>
                <Item>OBRIY_CUSTOM_LOAD</Item> 
            </ContentChangeSets>
        </Item>
        <Item>
            <NameHash>GROUP_UPDATE_WEAPON_PATCH</NameHash>
            <ContentChangeSets>
                <Item>OBRIY_CUSTOM_LOAD</Item>
            </ContentChangeSets>
        </Item>
        <Item>
            <NameHash>GROUP_UPDATE_MAP</NameHash>
            <ContentChangeSets>
                <Item>OBRIY_CUSTOM_LOAD</Item>
            </ContentChangeSets>
        </Item>
    </contentChangeSetGroups>
    <startupScript />
    <scriptCallstackSize value=""0"" />
    <type>EXTRACONTENT_LEVEL_PACK</type>
    <order value=""100"" />
    <minorOrder value=""0"" />
    <isLevelPack value=""true"" />
    <dependencyPackHash />
    <requiredVersion />
    <subPackCount value=""0"" />
</SSetupData>";

        // ContentXml: Лише стандартні файли DLC. Ніяких weapons.rpf тут бути не повинно!
        // Вони з'являться тут тільки якщо ми встановимо мод на зброю.
        public static string ContentXml => @"<?xml version=""1.0"" encoding=""UTF-8""?>
<CDataFileMgr__ContentsOfDataFileXml>
    <disabledFiles />
    <includedXmlFiles />
    <includedDataFiles />
    <dataFiles>
        <Item>
            <filename>dlc_patchDay18NG:/%PLATFORM%/levels/gta5/vehicles.rpf</filename>
            <fileType>RPF_FILE</fileType>
            <overlay value=""true"" />
            <disabled value=""true"" />
            <persistent value=""true"" />
        </Item>
        <Item>
            <filename>dlc_patchDay18NG:/%PLATFORM%/anim/ingame/clip_anim@.rpf</filename>
            <fileType>RPF_FILE</fileType>
            <overlay value=""true"" />
            <disabled value=""true"" />
            <persistent value=""true"" />
        </Item>
        <Item>
            <filename>dlc_patchDay18NG:/%PLATFORM%/anim/ingame/clip_veh@.rpf</filename>
            <fileType>RPF_FILE</fileType>
            <overlay value=""true"" />
            <disabled value=""true"" />
            <persistent value=""true"" />
        </Item>
        <Item>
            <filename>dlc_patchDay18NG:/%PLATFORM%/levels/gta5/props/Icons13.rpf</filename>
            <fileType>RPF_FILE</fileType>
            <overlay value=""true"" />
            <disabled value=""true"" />
            <persistent value=""true"" />
        </Item>
        <Item>
            <filename>dlc_patchDay18NG:/%PLATFORM%/levels/gta5/props/Icons13.ityp</filename>
            <fileType>DLC_ITYP_REQUEST</fileType>
            <overlay value=""false"" />
            <disabled value=""true"" />
            <persistent value=""false"" />
        </Item>
    </dataFiles>

    <contentChangeSets>
        <Item>
            <changeSetName>CCS_PATCHDAY18_NG_INIT</changeSetName>
            <filesToEnable />
        </Item>
        
        <Item>
            <changeSetName>CCS_PATCHDAY18_NG_STREAMING</changeSetName>
            <filesToEnable>
                <Item>dlc_patchDay18NG:/%PLATFORM%/levels/gta5/vehicles.rpf</Item>
                <Item>dlc_patchDay18NG:/%PLATFORM%/anim/ingame/clip_anim@.rpf</Item>
                <Item>dlc_patchDay18NG:/%PLATFORM%/anim/ingame/clip_veh@.rpf</Item>
                <Item>dlc_patchDay18NG:/%PLATFORM%/levels/gta5/props/Icons13.rpf</Item>
                <Item>dlc_patchDay18NG:/%PLATFORM%/levels/gta5/props/Icons13.ityp</Item>
            </filesToEnable>
        </Item>

        <Item>
            <changeSetName>OBRIY_CUSTOM_LOAD</changeSetName>
            <filesToEnable>
                 </filesToEnable>
        </Item>
    </contentChangeSets>
    <patchFiles />
</CDataFileMgr__ContentsOfDataFileXml>";
    }
}