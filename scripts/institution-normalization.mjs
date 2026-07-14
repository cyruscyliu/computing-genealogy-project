const institutionAliases = new Map([
  ["CISPA Helmholtz Center", "CISPA Helmholtz Center for Information Security"],
  ["德国CISPA亥姆霍兹信息安全中心", "CISPA Helmholtz Center for Information Security"],
  ["德国马克斯普朗克数学研究所（MPIM）; 德国汉诺威莱布尼兹大学", "Max Planck Institute for Mathematics; Leibniz University Hannover"],
  ["Delft University of Technology", "TU Delft"],
  ["电子科技大学", "UESTC"],
  ["法国巴黎萨克雷大学", "Paris-Saclay University"],
  ["复旦大学", "Fudan University"],
  ["海南大学", "Hainan University"],
  ["荷兰Radboud大学", "Radboud University"],
  ["华中科技大学", "Huazhong University of Science and Technology"],
  ["Indian Institute of Technology (IIT), Bombay", "Indian Institute of Technology Bombay"],
  ["暨南大学", "Jinan University"],
  ["Massachusetts Inst. of Technology", "Massachusetts Institute of Technology"],
  ["美国纽约大学石溪分校; 美国东北大学", "Stony Brook University; Northeastern University"],
  ["美国普渡大学", "Purdue University"],
  ["美国佐治亚理工学院", "Georgia Institute of Technology"],
  ["美国佐治亚理工学院，电子与计算机工程学院", "Georgia Institute of Technology"],
  ["南京邮电大学", "Nanjing University of Posts and Telecommunications"],
  ["山东大学", "Shandong University"],
  ["上海交通大学", "Shanghai Jiao Tong University"],
  ["天津大学", "Tianjin University"],
  ["Univ. of California - Berkeley", "University of California, Berkeley"],
  ["Univ. of Illinois at Urbana-Champaign", "University of Illinois Urbana-Champaign"],
  ["武汉大学", "Wuhan University"],
  ["香港理工大学", "Hong Kong Polytechnic University"],
  ["Zhejiang University, China", "Zhejiang University"],
  ["中国人民大学", "Renmin University of China"],
  ["浙江大学", "Zhejiang University"],
]);

export function normalizeInstitution(name, fallback = name) {
  if (!name) {
    return fallback;
  }

  return institutionAliases.get(name) ?? name;
}

export function getInstitutionAliases() {
  return new Map(institutionAliases);
}
