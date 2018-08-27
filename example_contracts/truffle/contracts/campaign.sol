/* Sample Crowdfunding Smart contract

Steps for executing this contract
1. Deploy CampaignFactory
2. Click createCampaign with minimumContribution.
3. getDeployedCampaigns.
4. Use the contract address to load Campaign contract.
5. Select accounts one by one, provide Value more than minimumContribution and click contribute.
6. Manager(contract creator) creates spending request using createProjectRequest with required parameters.
7. All accounts to approve the request using approveRequest and index as parameter.
8. Contract creator to finalizeRequest so that money can be dispensed.

Use getSummary and getProjectDetails to get details.

*/

/*
In real code use it like this
npm install -E zeppelin-solidity
import 'zeppelin-solidity/contracts/math/SafeMath.sol';
*/
//import "github.com/OpenZeppelin/zeppelin-solidity/contracts/math/SafeMath.sol";

library SafeMath {

  /**
  * @dev Multiplies two numbers, throws on overflow.
  */
  function mul(uint256 a, uint256 b) internal pure returns (uint256 c) {
    // Gas optimization: this is cheaper than asserting 'a' not being zero, but the
    // benefit is lost if 'b' is also tested.
    // See: https://github.com/OpenZeppelin/openzeppelin-solidity/pull/522
    if (a == 0) {
      return 0;
    }

    c = a * b;
    assert(c / a == b);
    return c;
  }

  /**
  * @dev Integer division of two numbers, truncating the quotient.
  */
  function div(uint256 a, uint256 b) internal pure returns (uint256) {
    // assert(b > 0); // Solidity automatically throws when dividing by 0
    // uint256 c = a / b;
    // assert(a == b * c + a % b); // There is no case in which this doesn't hold
    return a / b;
  }

  /**
  * @dev Subtracts two numbers, throws on overflow (i.e. if subtrahend is greater than minuend).
  */
  function sub(uint256 a, uint256 b) internal pure returns (uint256) {
    assert(b <= a);
    return a - b;
  }

  /**
  * @dev Adds two numbers, throws on overflow.
  */
  function add(uint256 a, uint256 b) internal pure returns (uint256 c) {
    c = a + b;
    assert(c >= a);
    return c;
  }
}

pragma solidity ^0.4.17;

contract CampaignFactory {
    address[] public deployedCampaigns;

    function createCampaign(uint minimum) public {
        address newCampaign = new Campaign(minimum, msg.sender);
        deployedCampaigns.push(newCampaign);
    }

    function getDeployedCampaigns() public view returns (address[]) {
        return deployedCampaigns;
    }
}

contract Campaign {

    using SafeMath for uint256;

    struct ProjectRequest {
        string projectCategory; /* short film, documentary, music video, song */
        string projectDescription;
        string projectTitle;
        address user;
        uint fundingGoal;
        uint dateOfPosting;
        uint dateOfClosing;
        uint value;
        address recipient;
	      bool complete;
        uint approvalCount;
        mapping(address => bool) approvals;
    }

    ProjectRequest[] private requests;
    address public manager;
    uint public minimumContribution;
    uint private totalContribution = 0;
    mapping(address => bool) public contributors;
    uint private contributorsCount = 0;
	  address[] private contributorList; // idea is to get list of contributors for any project
	//event GetSummary(string str);

    modifier isManager() {
        require(msg.sender == manager,"Only contract creator can call this function");
        _;
    }

    modifier isContributor() {
        require(contributors[msg.sender],"Only contributors can call this function");
        _;
    }

    modifier isContributorOrManager() {
        require(msg.sender == manager || contributors[msg.sender],"Only contributors or manager can call this function");
        _;
    }

    constructor(uint minimum, address creator) public {
        manager = creator;
        minimumContribution = minimum;
    }

    function contribute() public payable {
        require(msg.value > minimumContribution,"Contribution should be more than 100 wei");

        contributors[msg.sender] = true;
        contributorsCount = contributorsCount.add(1);
        
        contributorList.push(msg.sender);
        totalContribution = totalContribution.add(msg.value);
    }


/*
"short film", " short film about animals",  "animal life",  1000,  222, 2222, 2,0xdd870fa1b7c4700f2bd7f44238821c26f7392148
*/
    function createProjectRequest(
      string _projectCategory,
      string _projectDescription,
      string _projectTitle,
      uint _fundingGoal,
      uint _dateOfPosting,
      uint _dateOfClosing,
      uint _value,
      address _recipient
    ) public isManager {
        ProjectRequest memory newProjectRequest = ProjectRequest({
           projectCategory: _projectCategory,
           projectDescription: _projectDescription,
           projectTitle: _projectTitle,
           user: msg.sender,
           fundingGoal: _fundingGoal,
           dateOfPosting: _dateOfPosting,
           dateOfClosing: _dateOfClosing,
           value: _value,
           recipient: _recipient,
		   complete: false,
           approvalCount: 0
        });

        requests.push(newProjectRequest);
    }

    function approveRequest(uint index) public isContributor {
        ProjectRequest storage request = requests[index];

        //require(contributors[msg.sender],"You need to be a contributor to approve a request");
        require(!request.approvals[msg.sender],"You can approve request only once!!!");

        request.approvals[msg.sender] = true;
        request.approvalCount = request.approvalCount.add(1);
    }

/* 50% (half) majority required for finalizing spending request */

    function finalizeRequest(uint index) public isManager {
        ProjectRequest storage request = requests[index];

        require(request.approvalCount > (contributorsCount.div(2)),"Minimum 50% contributors should approve");
        require(!request.complete,"You can finalize request only once!!");
        require(request.value <= totalContribution.div(5),
                "Any funding request cannot exceed more than 20% of total contribution amount.");

        request.recipient.transfer(request.value);
        request.complete = true;
    }

    function getSummary() public isContributorOrManager view returns (uint, uint, uint, uint, address) {
        //emit GetSummary("summary created");
        return (minimumContribution,address(this).balance,requests.length,contributorsCount,manager);

    }

	function getRequestDetails(uint index) public isContributorOrManager view returns
	(string, string, string, address, uint, uint, uint,uint) {
		ProjectRequest storage request = requests[index];
		return (
		    request.projectCategory,
		    request.projectDescription,
		    request.projectTitle,
		    request.user,
		    request.fundingGoal,
		    request.dateOfPosting,
		    request.dateOfClosing,
		    request.approvalCount
		    );
	}

    function getRequestsCount() public isContributorOrManager view returns (uint) {
        return requests.length;
    }

    function getContractBalance() public isContributorOrManager view returns (uint) {
        return address(this).balance;
    }

    function getContributorList() public isContributorOrManager view returns (address[]) {
        return contributorList;
    }

    function getContributorCount() public isContributorOrManager view returns(uint) {
        return contributorsCount;
    }

    function getTotalContribution() public isContributorOrManager view returns(uint) {
        return totalContribution;
    }

}
